/**
 * A caching vanilla-extract compiler on Vite 8's Environment API: a port of
 * `@vanilla-extract/compiler` (MIT licensed, Copyright (c) 2021 SEEK) with Vite's own
 * `ModuleRunner` (`createServerModuleRunner`) replacing the legacy `vite-node` runner, and the
 * css adapter handed to the evaluated modules through `globalThis` instead of a vite-node
 * context injection.
 *
 * `.css.ts` modules are evaluated through an internal Vite dev server, so results are cached in
 * its module graph across rebuilds and invalidated per-file on change — unlike the per-file
 * rolldown `compile()` of `@sanity/vanilla-extract-integration` (used for one-shot library
 * builds by `@sanity/vanilla-extract-rolldown-plugin`), which re-bundles a module's whole
 * dependency graph on every call.
 */
import {isAbsolute, join} from 'node:path'
import {
  cssFileFilter,
  discoverCssModules,
  getPackageInfo,
  normalizePath,
  renderStylesheet,
  serializeVanillaModule,
  transform,
  type AtomicReport,
  type Composition,
  type CSS as Css,
  type IdentifierOption,
} from '@sanity/vanilla-extract-integration'
import type {Adapter} from '@vanilla-extract/css'
import {
  createServer,
  createServerModuleRunner,
  type EnvironmentModuleNode,
  type UserConfig as ViteUserConfig,
} from 'vite'
import type {EvaluatedModuleNode, ModuleRunner} from 'vite/module-runner'
import {lock} from './lock.ts'

/**
 * The evaluated `.css.ts` modules call `setAdapter(globalThis[...])` (spliced in by the
 * filescope transform below), binding whichever copy of `@vanilla-extract/css` the project
 * resolves to the adapter of the compilation in progress. The module runner evaluates modules
 * in-process, so `globalThis` is shared with the host — compilations are serialized by
 * {@link lock}, so the global never sees two adapters at once.
 */
const GLOBAL_ADAPTER_KEY = '__sanity_vanillaExtractCssAdapter__'
const globalAdapterIdentifier = `globalThis[${JSON.stringify(GLOBAL_ADAPTER_KEY)}]`

const globalAdapterStore = globalThis as typeof globalThis & {
  [GLOBAL_ADAPTER_KEY]?: Adapter
}

interface ModuleScanResult {
  cssDeps: string[]
  watchFiles: Set<string>
}

/**
 * Walks a module's import graph, collecting its vanilla-extract dependencies in import order
 * (dependencies before their importers) and every file to watch. Memoized per scan.
 */
function createModuleScanner() {
  const cache = new Map<string, ModuleScanResult>()

  const scanModule = (moduleNode: EnvironmentModuleNode, path: string[] = []): ModuleScanResult => {
    const watchFiles = new Set<string>()
    const cacheKey = moduleNode.id ?? moduleNode.file

    if (!cacheKey || moduleNode.id?.includes('@vanilla-extract/') || path.includes(cacheKey)) {
      return {cssDeps: [], watchFiles}
    }

    const cached = cache.get(cacheKey)
    if (cached) return cached

    cache.set(cacheKey, {cssDeps: [], watchFiles})

    const cssDeps = new Set<string>()
    const currentPath = [...path, cacheKey]

    for (const dependencyNode of moduleNode.importedModules) {
      const {cssDeps: dependencyCssDeps, watchFiles: dependencyWatchFiles} = scanModule(
        dependencyNode,
        currentPath,
      )
      for (const file of dependencyCssDeps) cssDeps.add(file)
      for (const file of dependencyWatchFiles) watchFiles.add(file)
    }

    const cssDepsArray = [...cssDeps]
    if (moduleNode.id && cssFileFilter.test(moduleNode.id)) {
      cssDepsArray.push(moduleNode.id)
    }
    if (moduleNode.file) {
      watchFiles.add(moduleNode.file)
    }

    const scanResult = {cssDeps: cssDepsArray, watchFiles}
    cache.set(cacheKey, scanResult)
    return scanResult
  }

  return scanModule
}

/** A map keyed by normalized absolute file paths, tolerating relative and Windows inputs. */
class NormalizedMap<V> extends Map<string, V> {
  readonly root: string

  constructor(root: string) {
    super()
    this.root = root
  }

  #normalizePath(filePath: string) {
    return normalizePath(isAbsolute(filePath) ? filePath : join(this.root, filePath))
  }

  override get(filePath: string): V | undefined {
    return super.get(this.#normalizePath(filePath))
  }

  override set(filePath: string, value: V): this {
    return super.set(this.#normalizePath(filePath), value)
  }

  override delete(filePath: string): boolean {
    return super.delete(this.#normalizePath(filePath))
  }
}

/** @public */
export interface ProcessedVanillaFile {
  /** The serialized JS module: virtual CSS imports followed by the evaluated exports. */
  source: string
  /** Files the `.css.ts` module (transitively) depends on. */
  watchFiles: Set<string>
}

/**
 * The result of a whole-program compilation (`compilation: 'whole-program'`), see
 * {@link Compiler.processVanillaProgram}.
 * @public
 */
export interface ProcessedVanillaProgram {
  /**
   * The program's CSS: one stylesheet over every member module, rendered in dependency order
   * (a module's `.css.ts` dependencies before it), then discovery order (sorted paths).
   */
  css: string
  /** The serialized JS of every member module, keyed by normalized absolute path. */
  modules: ReadonlyMap<string, string>
  /** The members whose serialized JS differs from the previous program build. */
  changedModules: ReadonlySet<string>
  /** The atomic pass's statistics, when `atomic` is enabled. */
  atomicReport: AtomicReport | undefined
}

/**
 * The id every member of a whole-program compilation imports for the program's CSS. It matches
 * the plugin's `.vanilla.css` hook filters and Vite's CSS pipeline picks it up like any other
 * virtual `.css` module.
 * @public
 */
export const PROGRAM_CSS_ID = 'virtual:vanilla-extract-program.vanilla.css'

/** @public */
export interface Compiler {
  /**
   * Evaluates a `.css.ts` module (through the internal Vite server, cached in its module graph)
   * and returns its serialized JS along with the files it depends on. The extracted CSS is
   * retrievable per file through {@link Compiler.getCssForFile}.
   *
   * In whole-program mode the module joins the program (if discovery didn't already find it),
   * the program is (re)built when stale, and the module's JS is served from it — importing the
   * program's single CSS module ({@link PROGRAM_CSS_ID}) instead of a per-file one.
   */
  processVanillaFile(
    filePath: string,
    options?: {outputCss?: boolean},
  ): Promise<ProcessedVanillaFile>
  /**
   * Whole-program mode only: (re)builds the program if it is stale — a member was added, or a
   * file changed (see {@link Compiler.invalidateFile}) — and returns it, including which
   * members' JS changed since the previous build so the host can invalidate exactly those.
   */
  processVanillaProgram(): Promise<ProcessedVanillaProgram>
  /**
   * Marks a changed file: its evaluated module (and importers) are dropped from the runner and
   * the compiler's module graph, and in whole-program mode the program becomes stale. Hosts call
   * this from their own file watcher so a rebuild never depends on the compiler's watcher
   * having fired first.
   */
  invalidateFile(filePath: string): Promise<void>
  /**
   * The extracted CSS of a previously processed `.css.ts` file, if any. In whole-program mode
   * only {@link PROGRAM_CSS_ID} has CSS: the program's stylesheet.
   */
  getCssForFile(filePath: string): {filePath: string; css: string} | undefined
  /**
   * All extracted CSS known to the compiler, e.g. to inline into HTML during dev SSR
   * (`mode: 'inlineCssInDev'`).
   *
   * Ordering contract (matching upstream `@vanilla-extract/compiler`): per-file CSS is
   * concatenated in first-evaluation order — within a single compilation that follows the
   * module graph (dependencies before their importers), across compilations it follows the
   * order the dev server first requested each `.css.ts` module. The order is stable across
   * recompiles (re-setting a key keeps its Map position). It is a FOUC stopgap, not the
   * authoritative cascade: the same CSS also loads through Vite's CSS pipeline in module-graph
   * order, and those later style tags win over the head-prepended inline block for
   * equal-specificity rules.
   */
  getAllCss(): string
  /**
   * The transitive importer tree of a file, from the compiler's own module graph (the consuming
   * dev server's graph gets rewritten by the plugin transform, so it can't reconstruct the
   * original chain). Stops at processed vanilla-extract module boundaries.
   */
  findImporterTree(
    filePath: string,
    transformedVanillaModules: ReadonlySet<string>,
  ): Promise<Set<EnvironmentModuleNode>>
  /**
   * Invalidates every non-`node_modules` module in the compiler's module graph and runner
   * cache, forcing the next {@link Compiler.processVanillaFile} to re-evaluate. The extracted
   * CSS of previous compilations intentionally stays available (like upstream
   * `@vanilla-extract/compiler`) until it's replaced by the re-evaluation: already-served
   * modules keep importing their virtual CSS, so dropping it would break those loads.
   */
  invalidateAllModules(): Promise<void>
  close(): Promise<void>
}

/** @public */
export interface CreateCompilerOptions {
  root: string
  identifiers?: IdentifierOption
  /**
   * Maps a `.css.ts` file path to the virtual CSS module specifier imported by its compiled JS.
   */
  cssImportSpecifier?: (filePath: string) => string
  /** Vite config forwarded to the internal compiler server (resolve options, plugins, etc). */
  viteConfig?: ViteUserConfig
  /**
   * The compiler watches the files it evaluates and invalidates its caches on change. Disable
   * during production builds, where nothing changes mid-build.
   * @defaultValue true
   */
  enableFileWatcher?: boolean
  /**
   * `'whole-program'` evaluates every `.css.ts` module under {@link CreateCompilerOptions.roots}
   * (plus any module requested that discovery missed) as one program with one adapter and
   * renders one stylesheet, instead of one per module. See `compilation` on the plugin options.
   * @defaultValue 'per-module'
   */
  compilation?: 'per-module' | 'whole-program'
  /**
   * The directories scanned for `.css.ts` modules in whole-program mode (`node_modules`, `dist`
   * and `.git` are skipped).
   * @defaultValue `[root]`
   */
  roots?: string[]
  /**
   * Enables the atomic pass (see `atomic` on the plugin options): per module, classes are
   * shared within a `.css.ts` module's file scope; in whole-program mode across the program.
   * @defaultValue false
   */
  atomic?: boolean
}

/** Invalidates the runner's evaluated modules for a changed file, and their importers. */
function invalidateRunnerFile(runner: ModuleRunner, filePath: string): void {
  const seen = new Set<EvaluatedModuleNode>()
  const stack = [...(runner.evaluatedModules.getModulesByFile(normalizePath(filePath)) ?? [])]
  for (let node = stack.pop(); node; node = stack.pop()) {
    if (seen.has(node)) continue
    seen.add(node)
    for (const importerId of node.importers) {
      const importer = runner.evaluatedModules.getModuleById(importerId)
      if (importer) stack.push(importer)
    }
    runner.evaluatedModules.invalidateModule(node)
  }
}

async function createCompilerServer({
  root,
  identifiers,
  viteConfig,
  enableFileWatcher,
  onFileChanged,
  onFileRemoved,
}: Required<
  Pick<CreateCompilerOptions, 'root' | 'identifiers' | 'viteConfig' | 'enableFileWatcher'>
> & {
  /** Called when the watcher reports a changed file (after the runner dropped it). */
  onFileChanged: (filePath: string) => void
  /** Called when the watcher reports a deleted file, so the compiler can prune its caches. */
  onFileRemoved: (filePath: string) => void
}) {
  const pkg = getPackageInfo(root)

  // The compiler evaluates `.css.ts` modules in Node, so its module resolution must stay
  // Node-shaped regardless of what the consuming app's config says — `ssr` and `environments`
  // are deliberately not forwarded (destructured off), and the resolve conditions are pinned:
  //
  // - `ssr.resolve.externalConditions` must prefer the `module` (ESM) builds of externalized
  //   dependencies. Vite's default (`['node', 'module-sync']`) falls through to the `default`
  //   (CJS) exports of the `@vanilla-extract/*` packages, whose wrappers pick their dev or
  //   prod build off `NODE_ENV` at first load. A CLI host (e.g. `sanity build`) typically
  //   imports this plugin before `vite build` flips `NODE_ENV` to `production`, so the host
  //   and the module runner would otherwise load two different copies of
  //   `@vanilla-extract/css/adapter` — the evaluated modules then bind the compilation
  //   adapter to one copy while `style()` appends CSS through the other (the mock adapter),
  //   silently dropping all CSS while the class-name exports keep working.
  // - The parent `ssr` options must not leak in: `ssr.noExternal: true` (set e.g. by the
  //   `sanity schema extract` worker) would inline CJS dependencies, which Vite's native
  //   `ModuleRunner` (unlike the legacy `vite-node`) cannot evaluate, and
  //   `ssr.target: 'webworker'` would flip the SSR environment to browser-leaning resolution.
  //
  // Covered end-to-end by the `@integration/vanilla-extract-studio` suite, which compares
  // `sanity dev` / `sanity build` / `sanity schema extract` output against
  // `@vanilla-extract/vite-plugin`.
  const {ssr: _ssr, environments: _environments, ...inheritedViteConfig} = viteConfig
  const nodeResolveConditions = ['node', 'import', 'module', 'default']

  const server = await createServer({
    ...inheritedViteConfig,
    // The compiler server should not rewrite imported asset URLs within vanilla-extract
    // stylesheets. Doing so interferes with Vite's resolution and bundling of these assets at
    // build time.
    base: undefined,
    configFile: false,
    root,
    // Don't include HTML middlewares
    appType: 'custom',
    // Forward the consumer's server options (e.g. `fs.allow`, needed to evaluate files outside
    // the workspace root), overriding only what the compiler manages itself: HMR stays off (the
    // compiler drives its own invalidation), and watching is disabled entirely for builds
    server: {
      ...viteConfig.server,
      hmr: false,
      watch: enableFileWatcher ? viteConfig.server?.watch : null,
    },
    logLevel: 'silent',
    optimizeDeps: {
      noDiscovery: true,
    },
    build: {
      assetsInlineLimit: viteConfig.build?.assetsInlineLimit,
    },
    resolve: {
      ...viteConfig.resolve,
      conditions: nodeResolveConditions,
      mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
    },
    ssr: {
      resolve: {
        conditions: nodeResolveConditions,
        externalConditions: nodeResolveConditions,
      },
    },
    // Vite's default SSR externalization applies: project files and linked packages are
    // evaluated through the runner (so they're cached in the module graph), while node_modules
    // dependencies are externalized to real Node imports — required for CJS dependencies,
    // which Vite's native `ModuleRunner` (unlike the legacy `vite-node`) cannot inline, and
    // for the `@vanilla-extract/*` packages, which must resolve to the same instances the
    // adapter of the compilation binds to (the plugin below forces the latter even in setups
    // that would otherwise inline them).
    plugins: [
      {
        name: 'sanity-vanilla-extract-externalize',
        enforce: 'pre',
        async resolveId(source, importer) {
          if (source.startsWith('@vanilla-extract/')) {
            const result = await this.resolve(source, importer, {skipSelf: true})
            return result ? {...result, external: true} : null
          }
          return null
        },
      },
      {
        name: 'sanity-vanilla-extract-transform',
        async transform(code, id) {
          if (!cssFileFilter.test(id)) return null
          // Inject the file scope and the adapter binding: the spliced
          // `setAdapter(globalThis[...])` call binds the project's own copy of
          // `@vanilla-extract/css` to the adapter of the compilation in progress
          return transform({
            source: code,
            rootPath: root,
            filePath: id,
            packageName: pkg.name,
            identOption: identifiers,
            globalAdapterIdentifier,
          })
        },
      },
      ...(viteConfig.plugins ?? []),
    ],
  })

  // Initialize the plugin pipeline of the environment the runner executes through
  await server.environments.ssr.pluginContainer.buildStart({})

  const runner = createServerModuleRunner(server.environments.ssr, {hmr: false})

  if (enableFileWatcher) {
    // The server invalidates its own module graph on change; the runner's evaluated-module
    // cache is normally invalidated through the HMR channel, which is disabled here
    server.watcher.on('change', (filePath) => {
      invalidateRunnerFile(runner, filePath)
      onFileChanged(filePath)
    })
    server.watcher.on('unlink', (filePath) => {
      invalidateRunnerFile(runner, filePath)
      // A re-evaluation overwrites the compiler caches on change, but nothing re-evaluates a
      // deleted module - prune its entries so e.g. `getAllCss()` stops serving its CSS
      onFileRemoved(filePath)
    })
  }

  return {server, runner}
}

/** Adapter callbacks received a file scope from `@vanilla-extract/css` >= 1.10.0 onwards. */
function requireFileScope(fileScope: {filePath: string} | undefined): {filePath: string} {
  if (!fileScope) {
    throw new Error(
      'Your version of @vanilla-extract/css must be at least v1.10.0. Please update to a compatible version.',
    )
  }
  return fileScope
}

/** @public */
export function createCompiler({
  root,
  identifiers = 'debug',
  cssImportSpecifier = (filePath) => `${filePath}.vanilla.css`,
  viteConfig = {},
  enableFileWatcher = true,
  compilation = 'per-module',
  roots = [root],
  atomic = false,
}: CreateCompilerOptions): Compiler {
  const processVanillaFileCache = new Map<
    string,
    {lastInvalidationTimestamp: number; result: ProcessedVanillaFile}
  >()

  const cssCache = new NormalizedMap<{css: string}>(root)
  /** Per-module rendering with the atomic pass: each module's identity → atomic classes. */
  const expansionsByModuleId = new NormalizedMap<ReadonlyMap<string, ReadonlyArray<string>>>(root)
  const classRegistrationsByModuleId = new NormalizedMap<{
    localClassNames: Set<string>
    composedClassLists: Composition[]
    /**
     * Composition identifiers `@vanilla-extract/css` marked as used while the module evaluated
     * (a `style([base, {…}])` with rules of its own marks itself), which the whole-program
     * serialization must keep even though no selector references them.
     */
    usedCompositions: Set<string>
  }>(root)

  /**
   * Whole-program mode keeps the raw CSS objects of every evaluated module across program
   * builds: the runner only re-evaluates invalidated modules, and the program renders all of
   * them together every time.
   */
  const cssObjsByModuleId = new NormalizedMap<Css[]>(root)
  /** Whole-program mode: every `.css.ts` module known to the program, as normalized paths. */
  const programMembers = new Set<string>()
  const programWatchFiles = new NormalizedMap<Set<string>>(root)
  let programDiscovery: Promise<void> | undefined
  let programResult: ProcessedVanillaProgram | undefined
  let programBuild: Promise<ProcessedVanillaProgram> | undefined
  /** Bumped whenever the program must be rebuilt; a build is current when it saw the latest. */
  let programVersion = 0
  let builtProgramVersion = -1

  const markProgramStale = () => {
    programVersion++
  }

  const serverPromise = createCompilerServer({
    root,
    identifiers,
    viteConfig,
    enableFileWatcher,
    onFileChanged() {
      markProgramStale()
    },
    onFileRemoved(filePath) {
      cssCache.delete(filePath)
      expansionsByModuleId.delete(filePath)
      classRegistrationsByModuleId.delete(filePath)
      cssObjsByModuleId.delete(filePath)
      programMembers.delete(normalizePath(filePath))
      programWatchFiles.delete(filePath)
      markProgramStale()
      const moduleId = normalizePath(filePath)
      for (const cacheKey of processVanillaFileCache.keys()) {
        if (cacheKey.startsWith(`${moduleId}|`)) {
          processVanillaFileCache.delete(cacheKey)
        }
      }
    },
  })

  const ensureProgramDiscovery = () => {
    programDiscovery ??= (async () => {
      for (const file of await discoverCssModules(roots)) programMembers.add(normalizePath(file))
    })()
    return programDiscovery
  }

  /**
   * Evaluates every program member (the runner re-runs only what was invalidated), orders the
   * `.css.ts` modules dependency-first from the compiler's module graph, renders them as one
   * stylesheet and serializes each member's JS from its own exports.
   */
  async function buildProgram(): Promise<ProcessedVanillaProgram> {
    const {server, runner} = await serverPromise
    await ensureProgramDiscovery()
    const version = programVersion
    const moduleGraph = server.environments.ssr.moduleGraph
    const members = [...programMembers].toSorted((a, b) => a.localeCompare(b))

    const cssAdapter: Adapter = {
      getIdentOption: () => identifiers,
      onBeginFileScope: (fileScope) => {
        // Before (re-)evaluating a file, reset its caches
        const moduleId = normalizePath(fileScope.filePath)
        cssObjsByModuleId.set(moduleId, [])
        classRegistrationsByModuleId.set(moduleId, {
          localClassNames: new Set(),
          composedClassLists: [],
          usedCompositions: new Set(),
        })
      },
      onEndFileScope: (fileScope) => {
        const moduleId = normalizePath(fileScope.filePath)
        cssObjsByModuleId.set(moduleId, cssObjsByModuleId.get(moduleId) ?? [])
      },
      registerClassName: (className, fileScope) => {
        classRegistrationsByModuleId
          .get(requireFileScope(fileScope).filePath)
          ?.localClassNames.add(className)
      },
      registerComposition: (composedClassList, fileScope) => {
        classRegistrationsByModuleId
          .get(requireFileScope(fileScope).filePath)
          ?.composedClassLists.push(composedClassList)
      },
      markCompositionUsed: (identifier) => {
        // `markCompositionUsed` carries no file scope: the composition belongs to whichever
        // module registered it
        for (const registrations of classRegistrationsByModuleId.values()) {
          if (registrations.composedClassLists.some((entry) => entry.identifier === identifier)) {
            registrations.usedCompositions.add(identifier)
          }
        }
      },
      appendCss: (css, fileScope) => {
        const moduleId = normalizePath(fileScope.filePath)
        const cssObjs = cssObjsByModuleId.get(moduleId) ?? []
        cssObjs.push(css)
        cssObjsByModuleId.set(moduleId, cssObjs)
      },
    }

    return lock(async () => {
      globalAdapterStore[GLOBAL_ADAPTER_KEY] = cssAdapter
      const exportsByMember = new Map<string, Record<string, unknown>>()
      try {
        for (const member of members) {
          exportsByMember.set(member, await runner.import<Record<string, unknown>>(member))
        }
      } finally {
        delete globalAdapterStore[GLOBAL_ADAPTER_KEY]
      }

      // Program order: each member's `.css.ts` dependencies before it, members in sorted order
      const scanModule = createModuleScanner()
      const orderedCssModules: string[] = []
      const seen = new Set<string>()
      for (const member of members) {
        const moduleNode = moduleGraph.getModuleById(member)
        if (!moduleNode) {
          throw new Error(`[vanilla-extract] Can't find module for ${member}`)
        }
        const {cssDeps, watchFiles} = scanModule(moduleNode)
        programWatchFiles.set(member, watchFiles)
        for (const cssDep of cssDeps) {
          const cssDepModuleId = normalizePath(cssDep)
          if (seen.has(cssDepModuleId)) continue
          seen.add(cssDepModuleId)
          orderedCssModules.push(cssDepModuleId)
        }
      }

      const localClassNames = new Set<string>()
      const composedClassLists: Composition[] = []
      const usedCompositions = new Set<string>()
      const cssObjs: Css[] = []
      for (const moduleId of orderedCssModules) {
        const registrations = classRegistrationsByModuleId.get(moduleId)
        if (registrations) {
          for (const className of registrations.localClassNames) localClassNames.add(className)
          composedClassLists.push(...registrations.composedClassLists)
          for (const identifier of registrations.usedCompositions) usedCompositions.add(identifier)
        }
        cssObjs.push(...(cssObjsByModuleId.get(moduleId) ?? []))
      }

      const rendered = renderStylesheet({
        localClassNames: [...localClassNames],
        composedClassLists,
        // The renderer mutates its input (pixelify, keyframes) and the objects live on across
        // program builds
        cssObjs: structuredClone(cssObjs),
        onCompositionUsed: (identifier) => usedCompositions.add(identifier),
        ...(atomic ? {atomic: {scopeKey: 'program', identOption: identifiers}} : {}),
      })
      const css = rendered.css.join('\n')

      // Unlike per-module compilation, the whole program knows every selector, so unreferenced
      // composition identifiers can be stripped like the rolldown plugin does
      const unusedCompositions = composedClassLists
        .filter(({identifier}) => !usedCompositions.has(identifier))
        .map(({identifier}) => identifier)
      const unusedCompositionRegex =
        unusedCompositions.length > 0 ? RegExp(`(${unusedCompositions.join('|')})\\s`, 'g') : null

      const modules = new Map<string, string>()
      const changedModules = new Set<string>()
      for (const [member, fileExports] of exportsByMember) {
        const source = serializeVanillaModule(
          [`import '${PROGRAM_CSS_ID}';`],
          {...fileExports},
          unusedCompositionRegex,
          atomic ? {localClassNames, expansions: rendered.expansions} : undefined,
        )
        if (programResult?.modules.get(member) !== source) changedModules.add(member)
        modules.set(member, source)
      }

      programResult = {css, modules, changedModules, atomicReport: rendered.report}
      builtProgramVersion = version
      return programResult
    })
  }

  const isProgramCurrent = (
    program: ProcessedVanillaProgram | undefined,
  ): program is ProcessedVanillaProgram =>
    program !== undefined && builtProgramVersion === programVersion

  /**
   * The current program, building it when stale. Concurrent callers share one in-flight build;
   * a member added or a file changed while a build is in flight only lands in the next one.
   */
  const ensureProgram = async (): Promise<ProcessedVanillaProgram> => {
    let program = programResult
    while (!isProgramCurrent(program)) {
      programBuild ??= buildProgram().finally(() => {
        programBuild = undefined
      })
      program = await programBuild
    }
    return program
  }

  async function processVanillaFileInProgram(filePath: string): Promise<ProcessedVanillaFile> {
    await ensureProgramDiscovery()
    if (!programMembers.has(filePath)) {
      // Requested but not discovered (outside `roots`): it joins the program from here on
      programMembers.add(filePath)
      markProgramStale()
    }
    const program = await ensureProgram()

    const source = program.modules.get(filePath)
    if (source === undefined) {
      throw new Error(`[vanilla-extract] ${filePath} is not part of the whole-program compilation`)
    }
    return {source, watchFiles: programWatchFiles.get(filePath) ?? new Set()}
  }

  return {
    async processVanillaFile(filePath, options = {}) {
      const {server, runner} = await serverPromise

      filePath = normalizePath(isAbsolute(filePath) ? filePath : join(root, filePath))
      if (compilation === 'whole-program') {
        return processVanillaFileInProgram(filePath)
      }

      const outputCss = options.outputCss ?? true
      const moduleGraph = server.environments.ssr.moduleGraph

      const cacheKey = `${filePath}|outputCss=${outputCss}`
      const cachedFile = processVanillaFileCache.get(cacheKey)
      if (cachedFile) {
        const moduleNode = moduleGraph.getModuleById(normalizePath(filePath))
        if (cachedFile.lastInvalidationTimestamp === moduleNode?.lastInvalidationTimestamp) {
          return cachedFile.result
        }
      }

      const cssByModuleId = new NormalizedMap<Css[]>(root)
      const localClassNames = new Set<string>()
      const composedClassLists: Composition[] = []

      const cssAdapter: Adapter = {
        getIdentOption: () => identifiers,
        onBeginFileScope: (fileScope) => {
          // Before evaluating a file, reset the cache for it
          const moduleId = normalizePath(fileScope.filePath)
          cssByModuleId.set(moduleId, [])
          classRegistrationsByModuleId.set(moduleId, {
            localClassNames: new Set(),
            composedClassLists: [],
            usedCompositions: new Set(),
          })
        },
        onEndFileScope: (fileScope) => {
          // Ensure the cache is populated even for files without any CSS, so `cssDeps` below
          // can tell "processed, no styles" apart from "never processed"
          const moduleId = normalizePath(fileScope.filePath)
          cssByModuleId.set(moduleId, cssByModuleId.get(moduleId) ?? [])
        },
        registerClassName: (className, fileScope) => {
          localClassNames.add(className)
          classRegistrationsByModuleId
            .get(requireFileScope(fileScope).filePath)
            ?.localClassNames.add(className)
        },
        registerComposition: (composedClassList, fileScope) => {
          composedClassLists.push(composedClassList)
          classRegistrationsByModuleId
            .get(requireFileScope(fileScope).filePath)
            ?.composedClassLists.push(composedClassList)
        },
        markCompositionUsed: () => {
          // This compiler currently retains all composition classes
        },
        appendCss: (css, fileScope) => {
          const moduleId = normalizePath(fileScope.filePath)
          const cssObjs = cssByModuleId.get(moduleId) ?? []
          cssObjs.push(css)
          cssByModuleId.set(moduleId, cssObjs)
        },
      }

      const {
        fileExports,
        cssImports,
        watchFiles,
        lastInvalidationTimestamp,
        expansions,
        localClassNames: allLocalClassNames,
      } = await lock(async () => {
        globalAdapterStore[GLOBAL_ADAPTER_KEY] = cssAdapter
        let evaluatedExports: Record<string, unknown>
        try {
          evaluatedExports = await runner.import<Record<string, unknown>>(filePath)
        } finally {
          delete globalAdapterStore[GLOBAL_ADAPTER_KEY]
        }

        const moduleId = normalizePath(filePath)
        const moduleNode = moduleGraph.getModuleById(moduleId)
        if (!moduleNode) {
          throw new Error(`[vanilla-extract] Can't find module for ${filePath}`)
        }

        const collectedCssImports: string[] = []
        const orderedComposedClassLists: Composition[] = []
        /** Identity → atomic classes across this module and its `.css.ts` dependencies. */
        const collectedExpansions = new Map<string, ReadonlyArray<string>>()

        const scanModule = createModuleScanner()
        const {cssDeps, watchFiles: scannedWatchFiles} = scanModule(moduleNode)

        for (const cssDep of cssDeps) {
          const cssDepModuleId = normalizePath(cssDep)
          const cssObjs = cssByModuleId.get(cssDepModuleId)
          const cachedCss = cssCache.get(cssDepModuleId)
          const cachedClassRegistrations = classRegistrationsByModuleId.get(cssDepModuleId)

          if (cachedClassRegistrations) {
            orderedComposedClassLists.push(...cachedClassRegistrations.composedClassLists)
          }

          if (!cssObjs && !cachedCss && !cachedClassRegistrations) {
            continue
          }

          if (cssObjs) {
            // The dependency was (re-)evaluated during this compilation: transform its CSS
            const rendered =
              cssObjs.length > 0
                ? renderStylesheet({
                    localClassNames: [...localClassNames],
                    composedClassLists: orderedComposedClassLists,
                    cssObjs,
                    // This compiler currently retains all composition classes
                    onCompositionUsed: () => {},
                    ...(atomic
                      ? {
                          atomic: {
                            scopeKey: cssDepModuleId,
                            identOption: identifiers,
                            fileScope: {filePath: cssDepModuleId},
                          },
                        }
                      : {}),
                  })
                : {css: [], expansions: new Map<string, string[]>(), report: undefined}
            cssCache.set(cssDepModuleId, {css: rendered.css.join('\n')})
            expansionsByModuleId.set(cssDepModuleId, rendered.expansions)
          } else if (cachedClassRegistrations) {
            // The dependency was served from the runner's cache: replay its class
            // registrations so compositions in downstream files keep resolving
            for (const localClassName of cachedClassRegistrations.localClassNames) {
              localClassNames.add(localClassName)
            }
            composedClassLists.push(...cachedClassRegistrations.composedClassLists)
          }

          const {css = ''} = cssCache.get(cssDepModuleId) ?? {}
          for (const [identity, atomicClasses] of expansionsByModuleId.get(cssDepModuleId) ?? []) {
            collectedExpansions.set(identity, atomicClasses)
          }

          // Check the transformed CSS, not `cssObjs.length`: a module can register CSS
          // objects that transform to nothing (e.g. `recipe()` calls `style({})` for a
          // default base class). Emitting an import for empty CSS leaves a dangling virtual
          // module that bundlers fail to resolve.
          if (css) {
            collectedCssImports.push(`import '${cssImportSpecifier(cssDepModuleId)}';`)
          }
        }

        return {
          fileExports: evaluatedExports,
          cssImports: outputCss ? collectedCssImports : [],
          watchFiles: scannedWatchFiles,
          lastInvalidationTimestamp: moduleNode.lastInvalidationTimestamp,
          expansions: collectedExpansions,
          localClassNames,
        }
      })

      const result: ProcessedVanillaFile = {
        source: serializeVanillaModule(
          cssImports,
          fileExports,
          null, // This compiler currently retains all composition classes
          atomic ? {localClassNames: allLocalClassNames, expansions} : undefined,
        ),
        watchFiles,
      }

      processVanillaFileCache.set(cacheKey, {lastInvalidationTimestamp, result})

      return result
    },

    async processVanillaProgram() {
      if (compilation !== 'whole-program') {
        throw new Error(
          '[vanilla-extract] processVanillaProgram() requires `compilation: "whole-program"`',
        )
      }
      return ensureProgram()
    },

    async invalidateFile(filePath) {
      const {server, runner} = await serverPromise
      const normalizedPath = normalizePath(isAbsolute(filePath) ? filePath : join(root, filePath))
      invalidateRunnerFile(runner, normalizedPath)
      const moduleGraph = server.environments.ssr.moduleGraph
      for (const moduleNode of moduleGraph.getModulesByFile(normalizedPath) ?? []) {
        moduleGraph.invalidateModule(moduleNode)
      }
      markProgramStale()
    },

    getCssForFile(filePath) {
      if (compilation === 'whole-program') {
        return filePath === PROGRAM_CSS_ID ? {css: programResult?.css ?? '', filePath} : undefined
      }
      filePath = isAbsolute(filePath) ? filePath : join(root, filePath)
      const result = cssCache.get(normalizePath(filePath))
      if (!result) return undefined
      return {css: result.css, filePath}
    },

    getAllCss() {
      if (compilation === 'whole-program') {
        return programResult?.css ? `${programResult.css}\n` : ''
      }
      let allCss = ''
      for (const {css} of cssCache.values()) {
        if (css) allCss += `${css}\n`
      }
      return allCss
    },

    async findImporterTree(filePath, transformedVanillaModules) {
      const {server} = await serverPromise

      // The compiler's module graph is always a subset of the consuming dev server's module
      // graph, so this early exit is hit for any module unrelated to vanilla-extract
      const moduleNode = server.environments.ssr.moduleGraph.getModuleById(normalizePath(filePath))
      if (!moduleNode) return new Set()

      return findImporterTree(moduleNode, transformedVanillaModules)
    },

    async invalidateAllModules() {
      const {server, runner} = await serverPromise

      for (const [id, node] of runner.evaluatedModules.idToModuleMap) {
        if (!id.includes('node_modules')) {
          runner.evaluatedModules.invalidateModule(node)
        }
      }

      const moduleGraph = server.environments.ssr.moduleGraph
      for (const [id, moduleNode] of moduleGraph.idToModuleMap) {
        if (!id.includes('node_modules')) {
          moduleGraph.invalidateModule(moduleNode)
        }
      }
      markProgramStale()
    },

    async close() {
      const {server} = await serverPromise
      await server.close()
    },
  }
}

function findImporterTree(
  moduleNode: EnvironmentModuleNode,
  transformedVanillaModules: ReadonlySet<string>,
  visited = new Set<string>(),
): Set<EnvironmentModuleNode> {
  const result = new Set<EnvironmentModuleNode>()
  if (!moduleNode.id || visited.has(moduleNode.id)) {
    return result
  }

  // Include the starting module in the tree
  result.add(moduleNode)
  visited.add(moduleNode.id)

  // Stop at processed vanilla-extract modules: they're a boundary that doesn't need to be
  // invalidated past
  if (transformedVanillaModules.has(moduleNode.id)) {
    return result
  }

  for (const importer of moduleNode.importers) {
    for (const mod of findImporterTree(importer, transformedVanillaModules, visited)) {
      result.add(mod)
    }
  }

  return result
}
