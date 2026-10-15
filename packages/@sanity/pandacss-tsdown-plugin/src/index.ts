import {existsSync, realpathSync} from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

import {createNodeDriver, type Driver} from '@pandacss/compiler'
import {
  createSourceTransformer,
  getInternalCssRuntimeSource,
  INTERNAL_CSS_IMPORT,
  INTERNAL_CSS_RESOLVED_ID,
  resolveCxSeparator,
  type SourceTransformer,
  transformSource,
} from '@pandacss/transformer'
import {type CustomAtRules, transform as lightningcss, type TransformOptions} from 'lightningcss'
import type {OutputChunk, PluginContext, RenderedChunk} from 'rolldown'
import type {ResolvedConfig, Rolldown, TsdownPlugin, UserConfig} from 'tsdown'

import {
  cssShimDtsFileName,
  cssShimDtsSource,
  cssShimFileName,
  cssShimSource,
} from './cssShimFileName.ts'
import {DEFAULT_CSS_FILE_NAME, normalizeAssetFileName, withCssCustomExports} from './exports.ts'
import {
  type CssExportsOptions,
  DEFAULT_CSS_EXPORT_CONDITIONS,
  normalizeCssExportsOptions,
} from './exportsOptions.ts'
import {esbuildTargetToLightningCSS} from './targets.ts'

export {
  type CssExportsOptions,
  cssShimDtsFileName,
  cssShimDtsSource,
  cssShimFileName,
  cssShimSource,
  DEFAULT_CSS_EXPORT_CONDITIONS,
  DEFAULT_CSS_FILE_NAME,
  esbuildTargetToLightningCSS,
  normalizeAssetFileName,
  normalizeCssExportsOptions,
  withCssCustomExports,
}

/**
 * Advanced LightningCSS options forwarded to `lightningcss.transform()`.
 *
 * @public
 */
export type LightningCSSOptions = Omit<TransformOptions<CustomAtRules>, 'filename' | 'code'>

/**
 * Options for `pandaCssPlugin`.
 *
 * @public
 */
export interface Options {
  /**
   * Working directory used to resolve `panda.config.*`.
   *
   * When omitted, falls back to tsdown's resolved `cwd` (or `process.cwd()`).
   */
  cwd?: string
  /**
   * Explicit path to the Panda CSS config file (`panda.config.ts`).
   */
  configPath?: string
  /**
   * Run Panda's codegen (`driver.codegen()`) at build start and again when the
   * Panda config reloads in watch mode, keeping `styled-system/` types and
   * runtime artifacts in sync with the config.
   *
   * Codegen only writes files whose contents changed and stays quiet when
   * nothing changed.
   *
   * @defaultValue `true`
   */
  codegen?: boolean
  /**
   * Override the `outdir` configured in `panda.config.*` (e.g. `'styled-system'`).
   */
  outdir?: string
  /**
   * Rewrite `css({...})` calls at build time into atomic class name strings via
   * `@pandacss/transformer` (like `@pandacss/vite`'s `transform: true`, but
   * enabled by default here so published library bundles do not carry the
   * `styled-system` runtime).
   *
   * Set to `false` to opt out and keep `styled-system/css` runtime calls.
   *
   * @defaultValue `true`
   */
  transform?: boolean
  /**
   * File name for the emitted CSS asset in the output bundle.
   *
   * Uses `'styles.css'` by default so it matches `@sanity/ui/styles.css` and
   * does not collide with `@sanity/vanilla-extract-tsdown-plugin`'s
   * `'bundle.css'` or Vite's default `'style.css'`.
   *
   * @defaultValue `'styles.css'`
   */
  fileName?: string
  /**
   * Prepend a side-effect CSS import to emitted entry chunks that contribute
   * Panda CSS rules, so consumers' bundlers automatically discover the
   * stylesheet via the module graph.
   *
   * - `false` (standalone default): do not modify emitted JS chunks; consumers
   *   opt in explicitly with `import '<pkg>/styles.css'`.
   * - `true` or `{nodeCompat: true}` (the `@sanity/tsdown-config` default):
   *   emit a bare package self-reference (`import '<pkg-name>/styles.css'`) on
   *   entry chunks when `package.json#name` is available, which resolves
   *   through `package.json#exports["./styles.css"]` — loading the no-op JS
   *   shim under the `"node"` condition in Node.js while bundlers and browsers
   *   resolve the real `./dist/styles.css` stylesheet. Falls back to a relative
   *   import (`import './styles.css'`) when `nodeCompat` is `false` or no
   *   package name is found.
   *
   * @defaultValue `false`
   */
  inject?: boolean | {nodeCompat?: boolean}
  /**
   * Automatically register `"./<fileName>": "./<outDir>/<fileName>"` (or a
   * conditional export map when `nodeCompat` is enabled) in `UserConfig.exports`
   * via tsdown's `customExports` hook, and emit the corresponding Node.js no-op
   * JS shim (`styles-css.js`) alongside `styles.css`.
   *
   * - If `UserConfig.exports` is already enabled in `tsdown.config.ts`, the CSS
   *   export entry is always added to `customExports` (unless `exports: false`
   *   is set on the user's tsdown config).
   * - Setting `exports: true` or passing a {@link CssExportsOptions} object
   *   also enables `UserConfig.exports` when it wasn't otherwise configured, and
   *   controls whether the `nodeCompat` shim and conditional export map are
   *   emitted.
   *
   * @defaultValue `false`
   */
  exports?: boolean | CssExportsOptions
  /**
   * Minify the emitted CSS bundle with LightningCSS.
   *
   * @defaultValue `false`
   */
  minify?: boolean
  /**
   * Target browsers for LightningCSS syntax lowering.
   *
   * Accepts an esbuild-style target (`'chrome120'`, `['chrome102', 'safari16.4']`),
   * a browserslist query (`'defaults'`), or `false` to disable lowering.
   */
  target?: string | string[] | false
  /**
   * Additional options forwarded to `lightningcss.transform()`.
   */
  lightningcss?: LightningCSSOptions
  /**
   * Explicit package name for self-referencing `inject` imports when running
   * outside tsdown (e.g. direct Rolldown builds without a `package.json`).
   */
  packageName?: string
}

type StylesheetLayerName = NonNullable<Parameters<Driver['getLayerCss']>[0]['layers']>[number]
type TransformHook = Extract<NonNullable<Rolldown.Plugin['transform']>, {handler: unknown}>
type TransformHandler = TransformHook['handler']
type Program = ReturnType<PluginContext['parse']>

const PANDA_LAYERS: StylesheetLayerName[] = ['reset', 'base', 'tokens', 'recipes', 'utilities']
const DTS_ID_RE = /\.d\.[cm]?ts$/
const SOURCE_ID_RE = /\.[cm]?[jt]sx?$/
const NODE_MODULES_RE = /[\\/]node_modules[\\/]/

interface DerivedSourceFilter {
  scoped: boolean
  includePatterns: RegExp[]
  excludePatterns: RegExp[]
  resolvedOutdir: string
}

function realpathOrSelf(filePath: string): string {
  try {
    return realpathSync(filePath)
  } catch {
    return filePath
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readGlobs(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

const UNSUPPORTED_FILTER_GLOB_RE = /[?+*@!]\(|\[[!^]|\{[^}]*\.\.[^}]*\}/

/**
 * Convert a Panda config glob (relative to `cwd`) into a `RegExp` matching
 * Rolldown's normalized POSIX module IDs, escaping the literal `cwd` prefix
 * separately so characters like `[1]` in `cwd` are never treated as glob syntax.
 */
function globToRegExp(glob: string, cwd: string): RegExp | undefined {
  if (UNSUPPORTED_FILTER_GLOB_RE.test(glob)) {
    return undefined
  }
  const normalizedGlob = glob.replace(/\\/g, '/').replace(/^(\.\/)+/, '')
  const realBase = realpathOrSelf(cwd).replace(/\\/g, '/').replace(/\/+$/, '')
  const isAbsoluteGlob =
    path.posix.isAbsolute(normalizedGlob) || /^[a-z]:\//i.test(normalizedGlob)

  let source = isAbsoluteGlob ? '' : `${escapeRegExp(realBase)}/`
  let inClass = false
  let braceDepth = 0

  for (let index = 0; index < normalizedGlob.length; index++) {
    const char = normalizedGlob[index] ?? ''
    if (inClass) {
      if (char === ']') inClass = false
      source += char
      continue
    }
    switch (char) {
      case '*': {
        if (normalizedGlob[index + 1] === '*') {
          if (normalizedGlob[index + 2] === '/') {
            source += '(?:.*/)?'
            index += 2
          } else {
            source += '.*'
            index += 1
          }
        } else {
          source += '[^/]*'
        }
        break
      }
      case '?':
        source += '[^/]'
        break
      case '[':
        inClass = true
        source += '['
        break
      case '{':
        braceDepth++
        source += '(?:'
        break
      case '}':
        if (braceDepth > 0) {
          braceDepth--
          source += ')'
        } else {
          source += '\\}'
        }
        break
      case ',':
        source += braceDepth > 0 ? '|' : ','
        break
      default:
        source += escapeRegExp(char)
    }
  }

  return new RegExp(`^${source}(?:\\?.*)?$`, process.platform === 'win32' ? 'i' : '')
}

function isInsideDir(filePath: string, dirPath: string): boolean {
  const rel = path.relative(realpathOrSelf(dirPath), realpathOrSelf(filePath))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function deriveSourceFilter(
  driver: Driver,
  cwd: string,
  outdirOverride: string | undefined,
): DerivedSourceFilter {
  const rawInclude = readGlobs(driver.config['include'])
  const rawExclude = readGlobs(driver.config['exclude'])
  const resolvedOutdir = path.resolve(cwd, driver.getOutdir(outdirOverride))

  const includePatterns: RegExp[] = []
  const excludePatterns: RegExp[] = []
  let hasUnsupportedGlob = false

  for (const pattern of rawInclude) {
    const compiled = globToRegExp(pattern.startsWith('!') ? pattern.slice(1) : pattern, cwd)
    if (!compiled) {
      hasUnsupportedGlob = true
      continue
    }
    if (pattern.startsWith('!')) {
      excludePatterns.push(compiled)
    } else {
      includePatterns.push(compiled)
    }
  }
  for (const pattern of rawExclude) {
    const compiled = globToRegExp(pattern.replace(/^!/, ''), cwd)
    if (!compiled) {
      hasUnsupportedGlob = true
      continue
    }
    excludePatterns.push(compiled)
  }

  if ((rawInclude.length === 0 && rawExclude.length === 0) || hasUnsupportedGlob) {
    return {
      scoped: false,
      includePatterns,
      excludePatterns,
      resolvedOutdir,
    }
  }

  return {
    scoped: true,
    includePatterns,
    excludePatterns,
    resolvedOutdir,
  }
}

function matchesSourceFilter(
  filePath: string,
  driver: Driver,
  filter: DerivedSourceFilter | undefined,
): boolean {
  if (DTS_ID_RE.test(filePath) || !SOURCE_ID_RE.test(filePath)) {
    return false
  }
  if (!filter) {
    return !NODE_MODULES_RE.test(filePath)
  }
  if (isInsideDir(filePath, filter.resolvedOutdir)) {
    return false
  }
  if (filter.scoped) {
    const normalized = realpathOrSelf(filePath).replace(/\\/g, '/')
    if (filter.excludePatterns.some((re) => re.test(normalized) || re.test(filePath))) {
      return false
    }
    if (
      filter.includePatterns.length > 0 &&
      !filter.includePatterns.some((re) => re.test(normalized) || re.test(filePath))
    ) {
      return false
    }
    return driver.isSourceFile(filePath)
  }
  const hasIncludeOrExclude =
    readGlobs(driver.config['include']).length > 0 ||
    readGlobs(driver.config['exclude']).length > 0
  if (hasIncludeOrExclude) {
    return driver.isSourceFile(filePath)
  }
  return !NODE_MODULES_RE.test(filePath)
}

async function readPackageName(cwd: string): Promise<string | undefined> {
  let dir = path.resolve(cwd)
  while (true) {
    try {
      const raw = await fs.readFile(path.join(dir, 'package.json'), 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'name' in parsed &&
        typeof parsed.name === 'string' &&
        parsed.name.length > 0
      ) {
        return parsed.name
      }
    } catch {
      // keep walking up until filesystem root
    }
    const parent = path.dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

function toPosixRelativeImport(fromChunkFileName: string, toAssetFileName: string): string {
  const fromDir = path.posix.dirname(fromChunkFileName.replace(/\\/g, '/'))
  const rel = path.posix.relative(fromDir === '.' ? '' : fromDir, toAssetFileName)

  return rel.startsWith('.') ? rel : `./${rel}`
}

/** Where a chunk's hashbang and leading directives end: `0` when it has neither. */
function prologueEnd(program: Program): number {
  let end = program.hashbang?.end ?? 0
  for (const statement of program.body) {
    if (statement.type !== 'ExpressionStatement' || !('directive' in statement)) break
    end = statement.end
  }
  return end
}

function chunkHasStyles(
  chunk: RenderedChunk,
  chunks: Record<string, RenderedChunk> | undefined,
  styledModules: ReadonlySet<string>,
): boolean {
  if (chunk.moduleIds.length === 0) {
    return styledModules.size > 0
  }
  const seen = new Set<string>()
  const queue: RenderedChunk[] = [chunk]
  for (let current = queue.pop(); current; current = queue.pop()) {
    if (seen.has(current.fileName)) continue
    seen.add(current.fileName)
    if (current.moduleIds.some((id) => styledModules.has(id.split('?')[0] ?? id))) {
      return true
    }
    if (!chunks) continue
    for (const imported of [...current.imports, ...current.dynamicImports]) {
      const importedChunk = chunks[imported]
      if (importedChunk) queue.push(importedChunk)
    }
  }
  return false
}

/**
 * Official Panda CSS plugin for tsdown (and Rolldown).
 *
 * Loads `panda.config.*` with `@pandacss/compiler` (`createNodeDriver`), runs
 * Panda's codegen (`driver.codegen()`) at build start and on watch-mode config
 * reloads so `styled-system/` stays in sync, scans project source files,
 * rewrites `css({...})` calls at build time via `@pandacss/transformer` by
 * default (`transform: true`), extracts all Panda CSS layers (`reset`, `base`,
 * `tokens`, `recipes`, `utilities`) with `emitLayerDeclaration: false`,
 * processes the stylesheet with LightningCSS (`--made-with-panda` stripped via
 * `unusedSymbols`), emits `styles.css` (plus optional Node.js `styles-css.js` /
 * `styles-css.d.ts` shims), and registers `"./styles.css"` in
 * `package.json#exports` via tsdown's `tsdownConfig` hook.
 *
 * @public
 */
export function pandaCssPlugin(options: Options = {}): TsdownPlugin {
  const {
    cwd,
    configPath,
    codegen: shouldCodegen = true,
    outdir,
    transform: shouldTransform = true,
    fileName = DEFAULT_CSS_FILE_NAME,
    inject = false,
    exports: enableExports,
    minify = false,
    target,
    lightningcss: lightningcssOptions,
    packageName: optionPackageName,
  } = options

  const normalizedFileName = normalizeAssetFileName(fileName)
  const normalizedExports = normalizeCssExportsOptions(enableExports, false)
  const injectEnabled = Boolean(inject)
  const injectNodeCompat =
    typeof inject === 'object' ? (inject.nodeCompat ?? true) : normalizedExports.nodeCompat
  let exportsEnabled = normalizedExports.enabled

  let resolvedCwd = cwd ? path.resolve(cwd) : process.cwd()
  let contextTarget: string | string[] | false | undefined
  let contextPackageName: string | undefined = optionPackageName
  let driver: Driver | undefined
  let driverPromise: Promise<Driver> | undefined
  let reloadPromise: Promise<void> | undefined
  let transformer: SourceTransformer | undefined
  let transformerCompiler: Driver['compiler'] | undefined
  let sourceFilter: DerivedSourceFilter | undefined
  let packageNamePromise: Promise<string | undefined> | undefined
  let needsConfigReload = false
  let hasBuiltOnce = false
  let parsedIds = new Set<string>()
  const configWatchFiles = new Set<string>()
  let scannedWatchFiles: string[] = []
  let scannedWatchDirs: string[] = []

  const getPackageName = (): Promise<string | undefined> => {
    packageNamePromise ??= readPackageName(resolvedCwd)
    return packageNamePromise
  }

  const resolveTransformer = (activeDriver: Driver): SourceTransformer => {
    if (!transformer || transformerCompiler !== activeDriver.compiler) {
      transformer = createSourceTransformer(activeDriver.compiler)
      transformerCompiler = activeDriver.compiler
    }
    return transformer
  }

  const runCodegen = (activeDriver: Driver): void => {
    if (!shouldCodegen) return
    activeDriver.codegen({
      cwd: resolvedCwd,
      ...(outdir ? {outdir} : {}),
    })
  }

  const updateConfigWatchFiles = (activeDriver: Driver): void => {
    configWatchFiles.clear()
    if (activeDriver.configPath) {
      const resolvedConfigPath = path.resolve(resolvedCwd, activeDriver.configPath)
      configWatchFiles.add(resolvedConfigPath)
      configWatchFiles.add(realpathOrSelf(resolvedConfigPath))
    }
    for (const dep of activeDriver.configDependencies) {
      const resolvedDep = path.resolve(resolvedCwd, dep)
      configWatchFiles.add(resolvedDep)
      configWatchFiles.add(realpathOrSelf(resolvedDep))
    }
  }

  const scanSources = (activeDriver: Driver): void => {
    const resolvedOutdir = path.resolve(resolvedCwd, activeDriver.getOutdir(outdir))
    const files: string[] = []
    for (const report of activeDriver.parseFiles()) {
      if (isInsideDir(report.path, resolvedOutdir)) {
        activeDriver.compiler.removeFile(report.path)
        continue
      }
      files.push(report.path)
    }
    scannedWatchFiles = files
    scannedWatchDirs = activeDriver.watchTargets().dirs.filter((dir) => existsSync(dir))
  }

  const refreshTransformFilter = (activeDriver: Driver): void => {
    sourceFilter = deriveSourceFilter(activeDriver, resolvedCwd, outdir)
  }

  const initDriver = (baseCwd: string): Promise<Driver> => {
    const nextCwd = cwd ? path.resolve(cwd) : path.resolve(baseCwd)
    if (driverPromise && nextCwd === resolvedCwd) {
      return driverPromise
    }
    resolvedCwd = nextCwd
    packageNamePromise = undefined
    driverPromise = createNodeDriver({
      cwd: resolvedCwd,
      ...(configPath ? {configPath} : {}),
    }).then((nextDriver) => {
      if (outdir) {
        nextDriver.config['outdir'] = outdir
      }
      refreshTransformFilter(nextDriver)
      runCodegen(nextDriver)
      scanSources(nextDriver)
      updateConfigWatchFiles(nextDriver)
      driver = nextDriver
      return nextDriver
    })
    return driverPromise
  }

  const reloadDriver = async (activeDriver: Driver): Promise<void> => {
    if (reloadPromise) {
      await reloadPromise
      return
    }
    reloadPromise = (async () => {
      needsConfigReload = false
      const diff = await activeDriver.reload()
      if (outdir) {
        activeDriver.config['outdir'] = outdir
      }
      if (diff.hasChanged) {
        refreshTransformFilter(activeDriver)
        runCodegen(activeDriver)
      }
      scanSources(activeDriver)
      updateConfigWatchFiles(activeDriver)
    })()
    try {
      await reloadPromise
    } finally {
      reloadPromise = undefined
    }
  }

  const transformHandler: TransformHandler = function transformHandler(code, id) {
    for (const file of configWatchFiles) {
      this.addWatchFile?.(file)
    }
    if (!driver) return null

    const cleanId = id.split('?')[0] ?? id
    if (!matchesSourceFilter(cleanId, driver, sourceFilter)) {
      parsedIds.delete(cleanId)
      return null
    }

    const parseReport = driver.compiler.parseFileSource(cleanId, code)
    const extracted = driver.compiler.extractFileSource(cleanId, code)
    const hasStyles =
      parseReport.cssCalls +
        parseReport.cvaCalls +
        parseReport.svaCalls +
        parseReport.jsxUsages >
        0 ||
      parseReport.diagnostics.length > 0 ||
      extracted.calls.length > 0 ||
      extracted.jsx.length > 0

    if (!shouldTransform) {
      if (hasStyles) {
        parsedIds.add(cleanId)
      } else {
        parsedIds.delete(cleanId)
      }
      return null
    }

    const result = transformSource({
      transformer: resolveTransformer(driver),
      path: cleanId,
      source: code,
      mode: 'build',
    })

    for (const dep of result.dependencies) {
      this.addWatchFile?.(dep)
    }

    if (hasStyles || result.changed || result.bailed) {
      parsedIds.add(cleanId)
    } else {
      parsedIds.delete(cleanId)
    }

    if (!result.changed || result.bailed || typeof result.code !== 'string') {
      return null
    }

    return {
      code: result.code,
      map: result.map ?? null,
    }
  }

  const plugin: TsdownPlugin = {
    name: 'sanity:pandacss-tsdown',

    tsdownConfig(config: UserConfig) {
      if (enableExports === false) return
      config.exports = withCssCustomExports(
        config.exports,
        normalizedFileName,
        enableExports,
        config.outDir,
      )
      if (config.exports) {
        exportsEnabled = true
      }
    },

    async tsdownConfigResolved(config: ResolvedConfig) {
      if (config.target !== undefined) {
        contextTarget = config.target
      }
      if (typeof config.pkg?.name === 'string' && config.pkg.name.length > 0) {
        contextPackageName = config.pkg.name
      }
      await initDriver(config.cwd || process.cwd())
    },

    async options(inputOptions) {
      await initDriver(inputOptions.cwd || resolvedCwd)
      if (!injectEnabled) return undefined
      return {
        ...inputOptions,
        experimental: {
          ...inputOptions.experimental,
          nativeMagicString: true,
        },
      }
    },

    buildStart: {
      order: 'pre',
      sequential: true,
      async handler() {
        const activeDriver = driver ?? (await initDriver(resolvedCwd))
        if (needsConfigReload || (hasBuiltOnce && this.meta?.watchMode)) {
          await reloadDriver(activeDriver)
        } else if (hasBuiltOnce) {
          runCodegen(activeDriver)
          scanSources(activeDriver)
        }
        hasBuiltOnce = true

        for (const file of configWatchFiles) {
          this.addWatchFile?.(file)
        }
        for (const file of scannedWatchFiles) {
          this.addWatchFile?.(file)
        }
        for (const dir of scannedWatchDirs) {
          this.addWatchFile?.(dir)
        }
      },
    },

    watchChange(id) {
      const cleanId = id.split('?')[0] ?? id
      const resolvedId = path.resolve(resolvedCwd, cleanId)
      if (
        configWatchFiles.has(resolvedId) ||
        configWatchFiles.has(realpathOrSelf(resolvedId)) ||
        driver?.isConfigFile(resolvedId)
      ) {
        needsConfigReload = true
      }
    },

    resolveId: {
      filter: {id: {include: [new RegExp(`^${escapeRegExp(INTERNAL_CSS_IMPORT)}$`)]}},
      handler(id) {
        return shouldTransform && id === INTERNAL_CSS_IMPORT ? INTERNAL_CSS_RESOLVED_ID : null
      },
    },

    load: {
      filter: {id: {include: [new RegExp(`^${escapeRegExp(INTERNAL_CSS_RESOLVED_ID)}$`)]}},
      handler(id) {
        if (!shouldTransform || id !== INTERNAL_CSS_RESOLVED_ID) return null
        return {
          code: getInternalCssRuntimeSource(resolveCxSeparator(driver?.config)),
          moduleType: 'js',
        }
      },
    },

    transform: {handler: transformHandler},

    async renderChunk(code, chunk, outputOptions, meta) {
      if (
        !injectEnabled ||
        !chunk.isEntry ||
        chunk.name.endsWith('.d') ||
        DTS_ID_RE.test(chunk.fileName) ||
        !chunkHasStyles(chunk, meta?.chunks, parsedIds)
      ) {
        return null
      }

      const format = outputOptions.format
      if (format && format !== 'es' && format !== 'cjs') {
        return null
      }

      const pkgName = injectNodeCompat
        ? (contextPackageName ?? (await getPackageName()))
        : undefined
      const cssImportPath = pkgName
        ? `${pkgName}/${normalizedFileName}`
        : toPosixRelativeImport(chunk.fileName, normalizedFileName)
      const statement =
        format === 'cjs'
          ? `require(${JSON.stringify(cssImportPath)});`
          : `import ${JSON.stringify(cssImportPath)};`
      const offset = prologueEnd(this.parse(code))

      if (meta?.magicString) {
        if (offset === 0) {
          meta.magicString.prepend(`${statement}\n`)
        } else {
          meta.magicString.appendLeft(offset, `\n${statement}`)
        }
        return meta.magicString
      }

      return {
        code:
          offset === 0
            ? `${statement}\n${code}`
            : `${code.slice(0, offset)}\n${statement}${code.slice(offset)}`,
        map: null,
      }
    },

    generateBundle(_outputOptions, bundle) {
      if (!driver) return

      const hasJsChunk = Object.values(bundle).some(
        (item): item is OutputChunk =>
          item.type === 'chunk' && !item.name.endsWith('.d') && !DTS_ID_RE.test(item.fileName),
      )
      if (!hasJsChunk) return

      const {css: rawCss} = driver.getLayerCss({
        layers: PANDA_LAYERS,
        emitLayerDeclaration: false,
      })

      let finalCss = rawCss

      if (rawCss.length > 0) {
        const targets =
          lightningcssOptions?.targets ??
          (target === false ? undefined : esbuildTargetToLightningCSS(target ?? contextTarget))
        const result = lightningcss({
          ...lightningcssOptions,
          filename: normalizedFileName,
          code: Buffer.from(rawCss),
          minify,
          ...(targets ? {targets} : {}),
          unusedSymbols: ['--made-with-panda', ...(lightningcssOptions?.unusedSymbols ?? [])],
        })
        finalCss = Buffer.from(result.code).toString('utf8')
      }

      const emitNodeCompatShim =
        (exportsEnabled && normalizedExports.nodeCompat) || (injectEnabled && injectNodeCompat)

      if (finalCss.length > 0 || exportsEnabled) {
        this.emitFile({
          type: 'asset',
          fileName: normalizedFileName,
          source: finalCss,
        })

        if (emitNodeCompatShim) {
          this.emitFile({
            type: 'asset',
            fileName: cssShimFileName(normalizedFileName),
            source: cssShimSource,
          })
          this.emitFile({
            type: 'asset',
            fileName: cssShimDtsFileName(normalizedFileName),
            source: cssShimDtsSource,
          })
        }
      }
    },
  }

  return plugin
}
