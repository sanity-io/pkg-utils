import fs from 'node:fs/promises'
import path from 'node:path'

import {createNodeDriver, type Driver} from '@pandacss/dev/node'
import {transformSource} from '@pandacss/transformer'
import {type CustomAtRules, transform as lightningcss, type TransformOptions} from 'lightningcss'
import type {ResolvedConfig, TsdownPlugin, UserConfig} from 'tsdown'

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
   * Override the `outdir` configured in `panda.config.*` (e.g. `'styled-system'`).
   */
  outdir?: string
  /**
   * Rewrite `css({...})` calls at build time into atomic class name strings via
   * `@pandacss/transformer` (same as `@pandacss/vite`'s `transform: true`).
   *
   * Keep `false` when `styled-system/css` is bundled so the runtime handles
   * dynamic and conditional styles.
   *
   * @defaultValue `false`
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
const PANDA_LAYERS: StylesheetLayerName[] = ['reset', 'base', 'tokens', 'recipes', 'utilities']
const DTS_ID_RE = /\.d\.[cm]?ts$/

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

/**
 * Official Panda CSS plugin for tsdown (and Rolldown).
 *
 * Scans source files with `@pandacss/dev/node` (`createNodeDriver`), optionally
 * rewrites `css({...})` calls at build time via `@pandacss/transformer`,
 * extracts all Panda CSS layers (`reset`, `base`, `tokens`, `recipes`,
 * `utilities`), processes the stylesheet with LightningCSS (`--made-with-panda`
 * stripped via `unusedSymbols`), emits `styles.css` (plus optional Node.js
 * `styles-css.js` / `styles-css.d.ts` shims), and registers `"./styles.css"`
 * in `package.json#exports` via tsdown's `tsdownConfig` hook.
 *
 * Does **not** run `driver.codegen()` — run `panda codegen` in your package's
 * `prepare` script so `styled-system/` exists before the build starts.
 *
 * @public
 */
export function pandaCssPlugin(options: Options = {}): TsdownPlugin {
  const {
    cwd,
    configPath,
    outdir,
    transform: shouldTransform = false,
    fileName = DEFAULT_CSS_FILE_NAME,
    inject = false,
    exports: enableExports,
    minify = false,
    target,
    lightningcss: lightningcssOptions,
    packageName: optionPackageName,
  } = options

  const normalizedFileName = normalizeAssetFileName(fileName)
  const normalizedExports = normalizeCssExportsOptions(enableExports, true)
  const injectEnabled = Boolean(inject)
  const injectNodeCompat =
    typeof inject === 'object' ? (inject.nodeCompat ?? true) : normalizedExports.nodeCompat
  const emitNodeCompatShim = normalizedExports.nodeCompat || (injectEnabled && injectNodeCompat)

  let resolvedCwd = cwd ? path.resolve(cwd) : process.cwd()
  let contextTarget: string | string[] | false | undefined
  let contextPackageName: string | undefined = optionPackageName
  let driver: Driver | undefined
  let packageNamePromise: Promise<string | undefined> | undefined
  let parsedIds = new Set<string>()

  const getPackageName = (): Promise<string | undefined> => {
    packageNamePromise ??= readPackageName(resolvedCwd)
    return packageNamePromise
  }

  const initDriver = async (baseCwd: string): Promise<Driver> => {
    resolvedCwd = cwd ? path.resolve(cwd) : path.resolve(baseCwd)
    packageNamePromise = undefined
    const nextDriver = await createNodeDriver({
      cwd: resolvedCwd,
      ...(configPath ? {configPath} : {}),
    })
    if (outdir) {
      nextDriver.config['outdir'] = outdir
    }
    nextDriver.parseFiles()
    driver = nextDriver
    return nextDriver
  }

  return {
    name: 'sanity:pandacss-tsdown',

    tsdownConfig(config: UserConfig) {
      config.exports = withCssCustomExports(
        config.exports,
        normalizedFileName,
        enableExports ?? false,
        config.outDir,
      )
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

    options(inputOptions) {
      if (!injectEnabled) return undefined
      return {
        ...inputOptions,
        experimental: {
          ...inputOptions.experimental,
          nativeMagicString: true,
        },
      }
    },

    async buildStart() {
      parsedIds = new Set<string>()
      // When running inside tsdown, `tsdownConfigResolved` already initialized
      // the driver; initialize here as a fallback for direct Rolldown usage.
      if (!driver) {
        await initDriver(resolvedCwd)
      }
    },

    transform: {
      filter: {
        id: {
          include: [/\.[cm]?[jt]sx?$/],
          exclude: [/node_modules/, DTS_ID_RE],
        },
      },
      handler(code, id) {
        if (!driver) return null

        const cleanId = id.split('?')[0] ?? id
        driver.compiler.parseFileSource(cleanId, code)
        parsedIds.add(cleanId)

        if (!shouldTransform) {
          return null
        }

        const result = transformSource({
          compiler: driver.compiler,
          path: cleanId,
          source: code,
          mode: 'build',
        })

        if (!result.changed || result.bailed || typeof result.code !== 'string') {
          return null
        }

        return {
          code: result.code,
          map: null,
        }
      },
    },

    async renderChunk(code, chunk, outputOptions, meta) {
      if (
        !injectEnabled ||
        !chunk.isEntry ||
        chunk.name.endsWith('.d') ||
        DTS_ID_RE.test(chunk.fileName) ||
        parsedIds.size === 0
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
          ? `require(${JSON.stringify(cssImportPath)});\n`
          : `import ${JSON.stringify(cssImportPath)};\n`

      if (meta?.magicString) {
        meta.magicString.prepend(statement)
        return meta.magicString
      }

      return {
        code: `${statement}${code}`,
        map: null,
      }
    },

    generateBundle(_outputOptions, bundle) {
      if (!driver) return

      const hasJsChunk = Object.values(bundle).some(
        (item) => item.type === 'chunk' && !DTS_ID_RE.test(item.fileName),
      )
      if (!hasJsChunk) return

      const {css: rawCss} = driver.getLayerCss({
        layers: PANDA_LAYERS,
        emitLayerDeclaration: false,
      })

      let finalCss = rawCss

      if (rawCss.length > 0) {
        const targets =
          target === false ? undefined : esbuildTargetToLightningCSS(target ?? contextTarget)
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

      if (finalCss.length > 0 || normalizedExports.enabled) {
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
}
