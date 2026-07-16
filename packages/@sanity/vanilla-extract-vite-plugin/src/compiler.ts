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
  getPackageInfo,
  normalizePath,
  serializeVanillaModule,
  transform,
  type IdentifierOption,
} from '@sanity/vanilla-extract-integration'
import type {Adapter} from '@vanilla-extract/css'
import {transformCss} from '@vanilla-extract/css/transformCss'
import {
  createServer,
  createServerModuleRunner,
  type EnvironmentModuleNode,
  type UserConfig as ViteUserConfig,
} from 'vite'
import type {EvaluatedModuleNode, ModuleRunner} from 'vite/module-runner'
import {lock} from './lock.ts'

type Css = Parameters<Adapter['appendCss']>[0]
type Composition = Parameters<Adapter['registerComposition']>[0]

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

/** @public */
export interface Compiler {
  /**
   * Evaluates a `.css.ts` module (through the internal Vite server, cached in its module graph)
   * and returns its serialized JS along with the files it depends on. The extracted CSS is
   * retrievable per file through {@link Compiler.getCssForFile}.
   */
  processVanillaFile(
    filePath: string,
    options?: {outputCss?: boolean},
  ): Promise<ProcessedVanillaFile>
  /** The extracted CSS of a previously processed `.css.ts` file, if any. */
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
}

/** Resolve conditions the compiler server must use when evaluating `.css.ts` in Node. */
const compilerResolveConditions = ['node', 'import', 'module', 'default'] as const
/** `mainFields` without `browser`, matching Node resolution for the compiler server. */
const compilerMainFields = ['module', 'jsnext:main', 'jsnext', 'main'] as const

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
  onFileRemoved,
}: Required<
  Pick<CreateCompilerOptions, 'root' | 'identifiers' | 'viteConfig' | 'enableFileWatcher'>
> & {
  /** Called when the watcher reports a deleted file, so the compiler can prune its caches. */
  onFileRemoved: (filePath: string) => void
}) {
  const pkg = getPackageInfo(root)

  const server = await createServer({
    ...viteConfig,
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
    // Parent app configs (notably `sanity build`) often enable the `browser` resolve
    // condition. The compiler evaluates `.css.ts` in Node via `ModuleRunner`; resolving the
    // browser build of `@vanilla-extract/css` makes `style()` use the runtime/inject adapter
    // path, so `appendCss` never reaches our cssCache and virtual `.vanilla.css` imports are
    // omitted (class names still export, CSS rules do not).
    //
    // Vite 8 merges `resolve` / `ssr.resolve` / `environments.ssr.resolve` conditions, so a
    // top-level override alone is not enough when the parent sets environment-specific
    // `browser` conditions — override all three.
    resolve: {
      ...viteConfig.resolve,
      conditions: [...compilerResolveConditions],
      mainFields: [...compilerMainFields],
    },
    ssr: {
      ...viteConfig.ssr,
      resolve: {
        ...viteConfig.ssr?.resolve,
        conditions: [...compilerResolveConditions],
        externalConditions: [...compilerResolveConditions],
      },
    },
    environments: {
      ...viteConfig.environments,
      ssr: {
        ...viteConfig.environments?.['ssr'],
        resolve: {
          ...viteConfig.environments?.['ssr']?.resolve,
          conditions: [...compilerResolveConditions],
          externalConditions: [...compilerResolveConditions],
        },
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

/** @public */
export function createCompiler({
  root,
  identifiers = 'debug',
  cssImportSpecifier = (filePath) => `${filePath}.vanilla.css`,
  viteConfig = {},
  enableFileWatcher = true,
}: CreateCompilerOptions): Compiler {
  const processVanillaFileCache = new Map<
    string,
    {lastInvalidationTimestamp: number; result: ProcessedVanillaFile}
  >()

  const cssCache = new NormalizedMap<{css: string}>(root)
  const classRegistrationsByModuleId = new NormalizedMap<{
    localClassNames: Set<string>
    composedClassLists: Composition[]
  }>(root)

  const serverPromise = createCompilerServer({
    root,
    identifiers,
    viteConfig,
    enableFileWatcher,
    onFileRemoved(filePath) {
      cssCache.delete(filePath)
      classRegistrationsByModuleId.delete(filePath)
      const moduleId = normalizePath(filePath)
      for (const cacheKey of processVanillaFileCache.keys()) {
        if (cacheKey.startsWith(`${moduleId}|`)) {
          processVanillaFileCache.delete(cacheKey)
        }
      }
    },
  })

  return {
    async processVanillaFile(filePath, options = {}) {
      const {server, runner} = await serverPromise

      filePath = normalizePath(isAbsolute(filePath) ? filePath : join(root, filePath))
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
          })
        },
        onEndFileScope: (fileScope) => {
          // Ensure the cache is populated even for files without any CSS, so `cssDeps` below
          // can tell "processed, no styles" apart from "never processed"
          const moduleId = normalizePath(fileScope.filePath)
          cssByModuleId.set(moduleId, cssByModuleId.get(moduleId) ?? [])
        },
        registerClassName: (className, fileScope) => {
          if (!fileScope) {
            throw new Error(
              'Your version of @vanilla-extract/css must be at least v1.10.0. Please update to a compatible version.',
            )
          }
          localClassNames.add(className)
          classRegistrationsByModuleId.get(fileScope.filePath)?.localClassNames.add(className)
        },
        registerComposition: (composedClassList, fileScope) => {
          if (!fileScope) {
            throw new Error(
              'Your version of @vanilla-extract/css must be at least v1.10.0. Please update to a compatible version.',
            )
          }
          composedClassLists.push(composedClassList)
          classRegistrationsByModuleId
            .get(fileScope.filePath)
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

      const {fileExports, cssImports, watchFiles, lastInvalidationTimestamp} = await lock(
        async () => {
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
              const cssRules =
                cssObjs.length > 0
                  ? transformCss({
                      localClassNames: [...localClassNames],
                      composedClassLists: orderedComposedClassLists,
                      cssObjs,
                    })
                  : []
              cssCache.set(cssDepModuleId, {css: cssRules.join('\n')})
            } else if (cachedClassRegistrations) {
              // The dependency was served from the runner's cache: replay its class
              // registrations so compositions in downstream files keep resolving
              for (const localClassName of cachedClassRegistrations.localClassNames) {
                localClassNames.add(localClassName)
              }
              composedClassLists.push(...cachedClassRegistrations.composedClassLists)
            }

            const {css = ''} = cssCache.get(cssDepModuleId) ?? {}

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
          }
        },
      )

      const result: ProcessedVanillaFile = {
        source: serializeVanillaModule(
          cssImports,
          fileExports,
          null, // This compiler currently retains all composition classes
        ),
        watchFiles,
      }

      processVanillaFileCache.set(cacheKey, {lastInvalidationTimestamp, result})

      return result
    },

    getCssForFile(filePath) {
      filePath = isAbsolute(filePath) ? filePath : join(root, filePath)
      const result = cssCache.get(normalizePath(filePath))
      if (!result) return undefined
      return {css: result.css, filePath}
    },

    getAllCss() {
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
