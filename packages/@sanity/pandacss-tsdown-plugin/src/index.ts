import {readdirSync, readFileSync, realpathSync, statSync} from 'node:fs'
import path from 'node:path'
import {createNodeDriver} from '@pandacss/compiler'
import {createDiagnosticLog, type ParseFileReport} from '@pandacss/compiler-shared'
import {
  createPandaSourcePluginHooks,
  createSourceTransformer,
  INTERNAL_CSS_IMPORT,
  INTERNAL_CSS_RESOLVED_ID,
  runSourceTransform,
  type SourceTransformer,
} from '@pandacss/transformer'
import {transform, type CustomAtRules, type Targets, type TransformOptions} from 'lightningcss'
import type {OutputChunk, RenderedChunk} from 'rolldown'
import type {ResolvedConfig, TsdownPlugin, UserConfig} from 'tsdown'
import {cssShimDtsFileName, cssShimDtsSource, cssShimFileName, cssShimSource} from './cssShim.ts'
import {
  createConditionalCssExport,
  createCssExport,
  insertCssExport,
  packageRelativeOutDir,
} from './exports.ts'
import {esbuildTargetToLightningCSS} from './targets.ts'

/**
 * Options passed through to [lightningcss](https://lightningcss.dev)'s `transform()`, the same
 * shape as `css.lightningcss` in [`@tsdown/css`](https://tsdown.dev/options/css). Like there,
 * `targets` takes precedence over the esbuild-style {@link Options.target | `target`} option,
 * while the plugin-managed fields (`minify` from the {@link Options.minify | `minify`} option,
 * and `cssModules`, which Panda's atomic class names make redundant) win over their
 * `lightningcss` counterparts. `unusedSymbols` is merged with `'--made-with-panda'`, which is
 * always removed.
 * @public
 */
export type LightningCSSOptions = Omit<TransformOptions<CustomAtRules>, 'filename' | 'code'>

/**
 * The shape of the {@link Options.exports | `exports`} option when it is an object.
 * @public
 */
export interface CssExportsOptions {
  /**
   * Declare a conditional export whose `browser`/`style` conditions point at the stylesheet
   * while `node`/`default` point at a no-op JS shim (e.g. `styles-css.js`, with a
   * `styles-css.d.ts` declaration for the `types` condition) emitted next to it, so the
   * subpath stays resolvable in runtimes that cannot load `.css` files.
   * @defaultValue false
   */
  nodeCompat?: boolean
}

/**
 * Options for {@link pandaPlugin}. `cwd`, `configPath`, `outdir` and `transform` match
 * [`@pandacss/vite`](https://panda-css.com/docs/installation/vite), which covers Vite-based
 * tooling (Vitest, `sanity dev`/`sanity build`) in the same projects. The CSS options follow the
 * `css` options of [`@tsdown/css`](https://tsdown.dev/options/css) and
 * `@sanity/vanilla-extract-tsdown-plugin`.
 * @public
 */
export interface Options {
  /**
   * The directory the Panda config is discovered from, and that its `include`/`exclude` globs
   * are relative to. Resolved against tsdown's `cwd`.
   * @defaultValue tsdown's `cwd`
   */
  cwd?: string
  /**
   * An explicit Panda config file, relative to {@link Options.cwd | `cwd`}. Otherwise
   * `panda.config.*` is discovered upward from `cwd`.
   */
  configPath?: string
  /**
   * Overrides the config's `outdir`, the `styled-system` directory that Panda's codegen
   * writes to, like `outdir` in `@pandacss/vite`. Modules in it are never parsed or transformed.
   */
  outdir?: string
  /**
   * Statically transform `css()`, `cva()`, `sva()`, pattern and JSX style calls in the bundled
   * modules into class name strings, like `transform` in `@pandacss/vite`. The output then no
   * longer imports the generated `styled-system` runtime for the calls Panda could transform;
   * calls it can't transform statically are reported as warnings.
   * @defaultValue false
   */
  transform?: boolean
  /**
   * Name of the emitted stylesheet, like `css.fileName` in `@tsdown/css` (which defaults to
   * `"style.css"`).
   * @defaultValue "styles.css"
   */
  fileName?: string
  /**
   * Minify the stylesheet with `lightningcss`, matching `css.minify` in `@tsdown/css`.
   * @defaultValue false
   */
  minify?: boolean
  /**
   * The target environment for CSS syntax lowering. Accepts esbuild-style target strings
   * (e.g. `'chrome90'`, `'safari16.2'`), like `css.target` in `@tsdown/css`. Set to `false`
   * to disable syntax lowering entirely.
   *
   * Defaults to tsdown's resolved top-level `target`. Matching `@tsdown/css`, syntax lowering
   * is skipped when no target is configured anywhere, or when the configured targets don't
   * include any browsers (e.g. `'node20'`). `@sanity/tsdown-config` layers its own default on
   * top, resolving browserless targets from `@sanity/browserslist-config` and passing them
   * through {@link Options.lightningcss | `lightningcss.targets`}.
   */
  target?: string | string[] | false
  /**
   * Options passed through to `lightningcss`'s `transform()`, like `css.lightningcss` in
   * `@tsdown/css`. `lightningcss.targets` takes precedence over the esbuild-style
   * {@link Options.target | `target`}.
   */
  lightningcss?: LightningCSSOptions
  /**
   * Inject an import of the stylesheet into every entry chunk that uses Panda styles, like
   * `css.inject` in `@tsdown/css` (and matching its default of `false`), so bundler-consumed
   * libraries load their CSS automatically. In CJS output it is a `require()` instead of an
   * `import`.
   *
   * The injected specifier depends on {@link Options.exports | `exports`}: a relative
   * `import "./<fileName>"` on its own, or the self-referential `"<pkg-name>/<fileName>"` bare
   * specifier when the stylesheet is published as an export subpath.
   * @defaultValue false
   */
  inject?: boolean
  /**
   * Publish the stylesheet as the `"./<fileName>"` export subpath of the package through
   * tsdown's [`exports` feature](https://tsdown.dev/options/package-exports), so consumers can
   * `import "<pkg-name>/<fileName>"` — which is also the specifier
   * {@link Options.inject | `inject`} then uses, instead of a relative path.
   *
   * - `true` declares a plain `"./<fileName>": "./<outDir>/<fileName>"` export.
   * - `{nodeCompat: true}` declares a conditional export instead, see
   *   {@link CssExportsOptions.nodeCompat}.
   * @defaultValue false
   */
  exports?: boolean | CssExportsOptions
}

/**
 * The default name of the emitted stylesheet (the {@link Options.fileName | `fileName`} option).
 * @public
 */
export const DEFAULT_CSS_FILE_NAME = 'styles.css'

/** Panda's marker custom property, always removed from the stylesheet. */
const MADE_WITH_PANDA = '--made-with-panda'

/** Matches `.d.ts`/`.d.mts`/`.d.cts` module ids and rendered chunk file names. */
const RE_DTS = /\.d\.[cm]?ts$/

/** Matches the JS/TS modules Panda extracts styles from. */
const RE_SOURCE = /\.[cm]?[jt]sx?$/

type NodeDriver = Awaited<ReturnType<typeof createNodeDriver>>

/** The `transform` hook's id filter, populated from the Panda config once it is loaded. */
interface IdFilter {
  include?: string[]
  exclude: (string | RegExp)[]
}

interface Logger {
  info: (message: string) => void
  warn: (message: string) => void
}

/**
 * A tsdown plugin that extracts the [Panda CSS](https://panda-css.com) stylesheet of a library
 * into a single `lightningcss`-optimized file, following the architecture (and option
 * vocabulary) of `@tsdown/css` and `@sanity/vanilla-extract-tsdown-plugin`.
 *
 * It loads the Panda config with `@pandacss/compiler` and runs Panda's codegen, so the generated
 * `styled-system` code and types match the config the stylesheet is built from. It then parses
 * the files matched by the config's `include`/`exclude` globs, and emits every cascade layer
 * (`reset`, `base`, `tokens`, `recipes` and `utilities`) without the layer order declaration. It
 * complements `@pandacss/vite`, which handles Vite-based tooling in the same project.
 * @public
 */
export function pandaPlugin(options: Options = {}): TsdownPlugin {
  const fileName = options.fileName ?? DEFAULT_CSS_FILE_NAME
  const minify = options.minify ?? false
  const inject = options.inject ?? false
  const transformEnabled = options.transform ?? false
  const lightningcss = options.lightningcss
  const exportsCss = Boolean(options.exports)
  const nodeCompat = typeof options.exports === 'object' && (options.exports.nodeCompat ?? false)
  const unusedSymbols = [...new Set([MADE_WITH_PANDA, ...(lightningcss?.unusedSymbols ?? [])])]

  let cwd = path.resolve(options.cwd ?? '.')
  /** The host-resolved default for the `target` option (tsdown's top-level `target`). */
  let contextTarget: string | string[] | undefined
  /** The consumer's package name, for the self-referential CSS import injected by `inject`. */
  let packageName: string | undefined
  /** tsdown's resolved (absolute) `outDir`, for the `exports` targets. */
  let resolvedOutDir: string | undefined

  let driver: NodeDriver | undefined
  let driverPromise: Promise<NodeDriver> | undefined
  let reloadConfig = false
  /**
   * The in-flight (or last) config reload. Hosts may run several builds with a shared plugin
   * instance (tsdown does, per output format), so every build waits for it before parsing,
   * transforming or emitting, not just the build that started it.
   */
  let reloading: Promise<void> = Promise.resolve()
  let transformer: SourceTransformer | undefined
  let transformerCompiler: NodeDriver['compiler'] | undefined
  const warnDiagnostics = createDiagnosticLog()

  /**
   * Ids of the modules that use Panda, for `inject`. Hosts may run several builds in parallel
   * with a shared plugin instance (tsdown does, per output format); they transform the same
   * modules to the same result, so the set converges.
   */
  const styledModules = new Set<string>()

  // Mutated in place once the config is loaded: rolldown reads hook filters after the `options`
  // hook (and tsdown awaits `tsdownConfigResolved` before building), so the populated filter is
  // the one it uses
  const idFilter: IdFilter = {exclude: [RE_DTS]}

  /** The config file and its dependencies, watched so a change reloads the config. */
  const configWatchFiles = new Set<string>()

  /** The files the last scan with options parsed, which Panda doesn't reconcile on its own. */
  let scannedFiles = new Set<string>()

  /**
   * Scans and parses the files matched by the config's `include`/`exclude` globs. Panda's own
   * scan only skips the config's `outdir`, so with the plugin's `outdir` override the generated
   * directory codegen writes to is excluded too. A scan with options doesn't drop the files
   * deleted since the last one, so that is done here.
   */
  function scanSources(loaded: NodeDriver): ParseFileReport[] {
    const configOutdir = path.resolve(cwd, loaded.getOutdir())
    const outdir = path.resolve(cwd, loaded.getOutdir(options.outdir))
    if (outdir === configOutdir) return loaded.parseFiles()

    const reports = loaded.parseFiles({
      exclude: [
        ...stringArray(loaded.config['exclude']),
        ...[configOutdir, outdir].map(
          (dir) => `${path.relative(cwd, dir).replaceAll('\\', '/')}/**`,
        ),
      ],
    })
    const parsed = new Set(reports.map((report) => report.path))
    for (const file of scannedFiles) {
      if (!parsed.has(file)) loaded.compiler.removeFile(file)
    }
    scannedFiles = parsed
    return reports
  }

  /**
   * Runs Panda's codegen into `outdir`. The native writer only rewrites files whose content
   * changed, so repeated runs leave watchers alone; the files it did write are reported.
   */
  function generate(loaded: NodeDriver, logger: Logger): void {
    const outdir = path.resolve(cwd, loaded.getOutdir(options.outdir))
    const previous = fileMtimes(outdir)
    const files = loaded.codegen(
      options.outdir === undefined ? undefined : {outdir: options.outdir},
    )
    const written = files.filter((file) => previous.get(path.resolve(file)) !== fileMtime(file))
    if (written.length === 0) return
    logger.info(
      `[pandacss] Generated ${written.length} ${written.length === 1 ? 'file' : 'files'} in ${path.relative(cwd, outdir) || '.'}`,
    )
  }

  /** Starts a reload when the config changed, queued after any reload already in flight. */
  function scheduleReload(loaded: NodeDriver, logger: Logger): Promise<void> {
    if (reloadConfig) {
      reloadConfig = false
      const reload = (): Promise<void> => reloadDriver(loaded, logger)
      reloading = reloading.then(reload, reload)
    }
    return reloading
  }

  /** The loaded driver, once any config reload in flight has finished. */
  async function readyDriver(): Promise<NodeDriver> {
    const loaded = await loadDriver()
    await reloading
    return loaded
  }

  async function reloadDriver(loaded: NodeDriver, logger: Logger): Promise<void> {
    const {hasChanged} = await loaded.reload()
    if (!hasChanged) return
    generate(loaded, logger)
    const previousFilter = idFilterKey(idFilter)
    configureIdFilter(idFilter, loaded, cwd, options.outdir)
    if (idFilterKey(idFilter) !== previousFilter) {
      logger.warn(
        `[pandacss] The \`include\`/\`exclude\` globs of the Panda config changed. The stylesheet follows them right away, but watch mode keeps the transform filter it started with: restart it so newly matched files are transformed and injected.`,
      )
    }
  }

  function loadDriver(): Promise<NodeDriver> {
    driverPromise ??= createNodeDriver({
      cwd,
      ...(options.configPath === undefined ? {} : {configPath: options.configPath}),
    }).then((loaded) => {
      driver = loaded
      configureIdFilter(idFilter, loaded, cwd, options.outdir)
      return loaded
    })
    return driverPromise
  }

  function resolveTransformer(compiler: NodeDriver['compiler']): SourceTransformer {
    if (!transformer || transformerCompiler !== compiler) {
      transformer = createSourceTransformer(compiler)
      transformerCompiler = compiler
    }
    return transformer
  }

  const sourceHooks = createPandaSourcePluginHooks(() => ({
    getCompiler: () => driver?.compiler,
    getTransformer: () => (driver ? resolveTransformer(driver.compiler) : undefined),
  }))

  function resolveTargets(): Targets | undefined {
    if (lightningcss?.targets) return lightningcss.targets
    if (options.target === false) return undefined
    const target = options.target ?? contextTarget
    if (target === undefined) return undefined
    return esbuildTargetToLightningCSS(target)
  }

  function resolvePackageName(): string {
    const name = packageName ?? readPackageName(cwd)
    if (!name) {
      throw new Error(
        `[pandacss] Unable to resolve the package name from package.json, which is required by \`exports\` for the self-referential CSS import. Disable \`exports\` (or \`inject\`) to wire up the CSS import yourself.`,
      )
    }
    return name
  }

  return {
    name: 'pandacss',

    tsdownConfig(config: UserConfig) {
      if (!exportsCss) return undefined
      const exportsOption = config.exports
      if (!exportsOption) return undefined
      const exportsOptions: Extract<NonNullable<UserConfig['exports']>, object> = exportsOption ===
      true
        ? {}
        : typeof exportsOption === 'string'
          ? {enabled: exportsOption}
          : exportsOption
      const configCwd = path.resolve(config.cwd ?? '.')
      const configOutDir = config.outDir ?? 'dist'
      const previousCustomExports = exportsOptions.customExports
      exportsOptions.customExports = async (exportsMap, context) => {
        const base =
          typeof previousCustomExports === 'function'
            ? await previousCustomExports(exportsMap, context)
            : previousCustomExports
              ? {...exportsMap, ...previousCustomExports}
              : exportsMap
        // Built from the resolved output directory, relative to the package: `outDir` may be
        // `./dist`, absolute, or the package root, none of which make a valid target as is
        // tsdown passes its `PackageJsonWithPath`, typed as the plain `PackageJson`
        const packageJsonPath = context.pkg['packageJsonPath']
        const outDir = packageRelativeOutDir(
          path.resolve(
            configCwd,
            typeof packageJsonPath === 'string' ? packageJsonPath : 'package.json',
          ),
          resolvedOutDir ?? path.resolve(configCwd, configOutDir),
        )
        const cssExport = nodeCompat
          ? createConditionalCssExport(fileName, outDir)
          : createCssExport(fileName, outDir)
        return insertCssExport(base, `./${fileName}`, cssExport)
      }
      config.exports = exportsOptions
      return undefined
    },

    async tsdownConfigResolved(config: ResolvedConfig) {
      if (config.target !== undefined) contextTarget = config.target
      if (config.pkg?.name !== undefined) packageName = config.pkg.name
      if (config.outDir !== undefined) resolvedOutDir = config.outDir
      if (!driverPromise) cwd = path.resolve(config.cwd, options.cwd ?? '.')
      await loadDriver()
    },

    // Codegen runs here, before any `buildStart` hook: the declaration build (tsdown's `dts`)
    // reads the generated types in its own `buildStart`, which runs in parallel with the others.
    // `inject` prepends the CSS import in `renderChunk` through rolldown's native MagicString
    // (`meta.magicString`), which keeps sourcemaps intact without a JS magic-string dependency.
    async options(inputOptions) {
      const loaded = await readyDriver()
      generate(loaded, {
        info: (message) => this.info(message),
        warn: (message) => this.warn(message),
      })
      if (!inject) return undefined
      return {
        ...inputOptions,
        experimental: {...inputOptions.experimental, nativeMagicString: true},
      }
    },

    // Watch mode only runs the `options` hook once, so a reloaded config regenerates here, ahead
    // of (and blocking) the other plugins' `buildStart` hooks
    buildStart: {
      order: 'pre',
      sequential: true,
      async handler() {
        const loaded = await loadDriver()
        const logger: Logger = {
          info: (message) => this.info(message),
          warn: (message) => this.warn(message),
        }
        await scheduleReload(loaded, logger)

        // Every parsed file is watched, not just the bundled modules: the stylesheet covers all
        // of them, so editing one that no entry imports must rebuild it too
        for (const report of scanSources(loaded)) {
          this.addWatchFile(report.path)
          warnDiagnostics(logger.warn, report.diagnostics, 'while parsing', {
            file: report.path,
            onlyNew: true,
          })
        }

        configWatchFiles.clear()
        for (const file of [
          loaded.configPath,
          ...loaded.configDependencies.map((dependency) => loaded.resolvePath(dependency)),
        ]) {
          const resolved = path.resolve(file)
          configWatchFiles.add(resolved)
          this.addWatchFile(resolved)
        }
      },
    },

    watchChange(id) {
      if (configWatchFiles.has(path.resolve(id)) || driver?.isConfigFile(id)) reloadConfig = true
    },

    resolveId: {
      filter: {id: exactRegex(INTERNAL_CSS_IMPORT)},
      handler(id) {
        return transformEnabled ? sourceHooks.resolveId(id) : null
      },
    },

    load: {
      filter: {id: exactRegex(INTERNAL_CSS_RESOLVED_ID)},
      handler(id) {
        return transformEnabled ? sourceHooks.load(id) : null
      },
    },

    transform: {
      order: 'pre',
      filter: {id: idFilter},
      async handler(code, id) {
        const [file = id] = id.split('?')
        if (!RE_SOURCE.test(file)) return null
        const loaded = await readyDriver()
        // Watch mode keeps the filter it started with, so after a config reload this is what
        // applies the narrowed globs
        if (!loaded.isSourceFile(file)) {
          styledModules.delete(id)
          return null
        }
        const warn = (message: string): void => this.warn(message)

        const report = loaded.compiler.parseFileSource(file, code)
        warnDiagnostics(warn, report.diagnostics, 'while parsing', {file, onlyNew: true})
        // The parse report only counts `css`/`cva`/`sva` calls and JSX, while the extractor also
        // matches patterns, config recipes and token lookups, which need the stylesheet too
        const {calls, jsx} = loaded.compiler.extractFileSource(file, code)
        if (calls.length > 0 || jsx.length > 0) styledModules.add(id)
        else styledModules.delete(id)
        if (!transformEnabled) return null

        const compiler = loaded.compiler
        const result = runSourceTransform(
          this,
          {
            getCompiler: () => compiler,
            getTransformer: () => resolveTransformer(compiler),
            mode: 'build',
          },
          code,
          file,
        )
        if (!result) return null
        warnDiagnostics(warn, result.diagnostics, 'while transforming source', {
          file,
          onlyNew: true,
        })
        if (result.bailed) {
          warn(
            `[pandacss] Some style calls in ${file} could not be transformed statically, so the output still imports the generated \`styled-system\` runtime for them.`,
          )
        }
        return {code: result.code, map: result.map}
      },
    },

    // Inject the CSS import into entry chunks that use Panda styles: relative by default (like
    // `css.inject` in `@tsdown/css`), or the self-referential bare specifier when the stylesheet
    // is published as an export subpath
    renderChunk(code, chunk, outputOptions, meta) {
      if (!inject || styledModules.size === 0) return undefined
      // The `.d` name / `.d.ts` file checks skip the chunks of tsdown's d.ts passes
      if (!chunk.isEntry || chunk.name.endsWith('.d') || RE_DTS.test(chunk.fileName))
        return undefined
      const {format} = outputOptions
      if (format !== 'es' && format !== 'cjs') return undefined
      if (!chunkHasStyles(chunk, meta.chunks, styledModules)) return undefined

      const specifier = JSON.stringify(
        exportsCss
          ? `${resolvePackageName()}/${fileName}`
          : relativeImportPath(chunk.fileName, fileName),
      )
      const statement = format === 'cjs' ? `require(${specifier});\n` : `import ${specifier};\n`

      const {magicString} = meta
      if (magicString) {
        magicString.prepend(statement)
        return magicString
      }
      if (outputOptions.sourcemap) {
        this.warn(
          `[pandacss] rolldown's native magic-string is unavailable (another plugin's \`options\` hook may have disabled \`experimental.nativeMagicString\`), so the CSS import injected into "${chunk.fileName}" shifts its sourcemap by one line.`,
        )
      }
      return {code: statement + code}
    },

    // Emit the stylesheet (optimized with lightningcss) and, with `exports.nodeCompat`, the JS
    // shim
    async generateBundle(_outputOptions, bundle) {
      // tsdown's cjs d.ts pass renders no JS chunks, so skip it instead of re-emitting the assets
      const hasChunks = Object.values(bundle).some(
        (assetOrChunk): assetOrChunk is OutputChunk =>
          assetOrChunk.type === 'chunk' &&
          !assetOrChunk.name.endsWith('.d') &&
          !RE_DTS.test(assetOrChunk.fileName),
      )
      if (!hasChunks) return

      const loaded = await readyDriver()
      const output = loaded.getLayerCss({
        layers: ['reset', 'base', 'tokens', 'recipes', 'utilities'],
        emitLayerDeclaration: false,
        polyfill: loaded.config['polyfill'] === true,
      })
      warnDiagnostics(
        (message) => this.warn(message),
        output.diagnostics,
        'while generating the stylesheet',
        {onlyNew: true},
      )

      let css = output.css
      if (css) {
        // The plugin-managed fields win over their `lightningcss` counterparts, like
        // `@tsdown/css`. lightningcss always runs so `--made-with-panda` is removed.
        const result = transform({
          filename: fileName,
          code: new TextEncoder().encode(css),
          ...lightningcss,
          unusedSymbols,
          minify,
          cssModules: false,
          targets: resolveTargets(),
        })
        for (const warning of result.warnings) {
          this.warn(`[pandacss] ${warning.message} (${warning.loc.filename}:${warning.loc.line})`)
        }
        css = new TextDecoder().decode(result.code)
        if (css.length && !css.endsWith('\n')) css += '\n'
      }

      // With `exports`, the `./<fileName>` export (written into `package.json` at config
      // resolution, before any CSS is known) must resolve, so the file is emitted even when empty
      if (!css && !exportsCss) return

      this.emitFile({type: 'asset', fileName, source: css})

      if (nodeCompat) {
        this.emitFile({
          type: 'asset',
          fileName: cssShimFileName(fileName),
          source: cssShimSource(fileName),
        })
        this.emitFile({
          type: 'asset',
          fileName: cssShimDtsFileName(fileName),
          source: cssShimDtsSource(fileName),
        })
      }
    },
  }
}

/**
 * Scope the `transform` hook to the config's `include`/`exclude` globs, resolved against `cwd`
 * since rolldown matches them against absolute module ids. Without `include` the filter is not
 * scoped. The generated `outdir` is always excluded. Rewrites the filter in place, so it also
 * picks up a reloaded config.
 */
function configureIdFilter(
  idFilter: IdFilter,
  driver: NodeDriver,
  cwd: string,
  outdir: string | undefined,
): void {
  // Module ids are real paths, so a symlinked `cwd` (e.g. macOS `/tmp`) must be resolved first
  const realCwd = realpathOrSelf(cwd)
  const base = realCwd.replaceAll('\\', '/')
  const toAbsolute = (glob: string): string =>
    path.posix.isAbsolute(glob) || /^[a-z]:\//i.test(glob) ? glob : path.posix.join(base, glob)

  const include: string[] = []
  const exclude: (string | RegExp)[] = [RE_DTS]
  for (const glob of stringArray(driver.config['include'])) {
    if (glob.startsWith('!')) exclude.push(toAbsolute(glob.slice(1)))
    else include.push(toAbsolute(glob))
  }
  for (const glob of stringArray(driver.config['exclude'])) {
    exclude.push(toAbsolute(glob.replace(/^!/, '')))
  }
  const outdirPath = path.relative(cwd, path.resolve(cwd, driver.getOutdir(outdir)))
  exclude.push(`${path.resolve(realCwd, outdirPath).replaceAll('\\', '/')}/**`)

  idFilter.exclude = exclude
  if (include.length > 0) idFilter.include = include
  else delete idFilter.include
}

function idFilterKey(idFilter: IdFilter): string {
  return JSON.stringify([idFilter.include ?? null, idFilter.exclude.map(String)])
}

/** The modification time of every file under `dir`, keyed by resolved path. */
function fileMtimes(dir: string): Map<string, number> {
  const mtimes = new Map<string, number>()
  let entries: string[]
  try {
    entries = readdirSync(dir, {recursive: true, encoding: 'utf8'})
  } catch {
    return mtimes
  }
  for (const entry of entries) {
    const file = path.resolve(dir, entry)
    const mtime = fileMtime(file)
    if (mtime !== undefined) mtimes.set(file, mtime)
  }
  return mtimes
}

function fileMtime(file: string): number | undefined {
  try {
    const stats = statSync(file)
    return stats.isFile() ? stats.mtimeMs : undefined
  } catch {
    return undefined
  }
}

function realpathOrSelf(file: string): string {
  try {
    return realpathSync(file)
  } catch {
    return file
  }
}

function stringArray(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function exactRegex(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`)
}

/** The name of the nearest `package.json` at or above `cwd`, for builds outside tsdown. */
function readPackageName(cwd: string): string | undefined {
  for (let dir = cwd; ; dir = path.dirname(dir)) {
    try {
      const pkg: unknown = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'))
      const name = typeof pkg === 'object' && pkg !== null && 'name' in pkg ? pkg.name : undefined
      return typeof name === 'string' ? name : undefined
    } catch {
      if (path.dirname(dir) === dir) return undefined
    }
  }
}

/**
 * The relative import path from a chunk to the emitted CSS file (which lives at the root of the
 * output directory), like the `css.inject` implementation in `@tsdown/css`.
 */
function relativeImportPath(chunkFileName: string, cssFileName: string): string {
  const relativePath = path.posix.relative(path.posix.dirname(chunkFileName), cssFileName)
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

/** Whether a chunk (or any chunk it imports, transitively) contains a module with Panda styles. */
function chunkHasStyles(
  chunk: RenderedChunk,
  chunks: Record<string, RenderedChunk>,
  styledModules: ReadonlySet<string>,
): boolean {
  const seen = new Set<string>()
  const queue: RenderedChunk[] = [chunk]
  for (let current = queue.pop(); current; current = queue.pop()) {
    if (seen.has(current.fileName)) continue
    seen.add(current.fileName)
    if (current.moduleIds.some((id) => styledModules.has(id))) return true
    for (const imported of [...current.imports, ...current.dynamicImports]) {
      const importedChunk = chunks[imported]
      if (importedChunk) queue.push(importedChunk)
    }
  }
  return false
}
