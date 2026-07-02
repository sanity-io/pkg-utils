import {readFileSync} from 'node:fs'
import path from 'node:path'
import browserslistConfig from '@sanity/browserslist-config'
import {vanillaExtractPlugin} from '@vanilla-extract/rollup-plugin'
import {defineConfig as defineTsdownConfig, type Rolldown, type UserConfig} from 'tsdown'
import {bundleCssShim} from './bundleCssShim.ts'
import {optimizeCss} from './optimizeCss.ts'
import {
  createConditionalCssExport,
  insertCssExport,
  resolveVanillaExtract,
  resolveVanillaExtractCssName,
  type PackageVanillaExtractOptions,
} from './vanillaExtract.ts'

export type {PackageVanillaExtractOptions}

/**
 * @public
 */
export interface PackageOptions extends Pick<UserConfig, 'tsconfig' | 'entry' | 'format'> {
  /**
   * @defaultValue 'neutral'
   */
  platform?: UserConfig['platform']
  /**
   * Enables `@vanilla-extract/rollup-plugin` to extract CSS into a separate file, with support for
   * minifying the extracted CSS. Pass `true` to use the defaults, or an object to customize.
   *
   * By default (`extract.compatMode: true`) the config also injects the self-referential
   * `import "<pkg>/bundle.css"`, emits a `bundle.css.js` shim, and writes the conditional
   * `"./bundle.css"` export to `package.json` - see {@link PackageVanillaExtractOptions}.
   * This is the same feature as `rollup.vanillaExtract` in `@sanity/pkg-utils`.
   * @alpha
   */
  vanillaExtract?: boolean | PackageVanillaExtractOptions
}

/**
 * @public
 */
export function defineConfig(options: PackageOptions = {}): UserConfig {
  const {entry} = options
  const tsconfig = options.tsconfig ?? 'tsconfig.json'
  const platform = options.platform ?? 'neutral'
  const report = {gzip: false} as const satisfies UserConfig['report']
  const publint = true
  const hash = false
  const format = options.format ?? 'esm'
  const inputOptions = {
    preserveEntrySignatures: 'strict',
    experimental: {attachDebugInfo: 'none'},
  } as const satisfies UserConfig['inputOptions']

  // `outDir` is not configurable (yet), so the tsdown default is a known constant. It is needed to
  // build the conditional CSS export paths below.
  const outDir = 'dist'

  // Resolve vanilla-extract options + the conditional CSS export "compat mode"
  const vanillaExtract = resolveVanillaExtract(options.vanillaExtract)
  const vanillaExtractCssName = resolveVanillaExtractCssName(vanillaExtract.options)

  const plugins = vanillaExtract.enabled
    ? [
        // Rolldown supports most Rollup plugins, but the plugin types are not identical, so the
        // official guidance is to cast: https://tsdown.dev/advanced/plugins#rollup-plugins
        // oxlint-disable-next-line no-unsafe-type-assertion
        vanillaExtractPlugin({
          identifiers: vanillaExtract.options.identifiers ?? 'short',
          cwd: vanillaExtract.options.cwd,
          esbuildOptions: vanillaExtract.options.esbuildOptions,
          unstable_injectFilescopes: vanillaExtract.options.unstable_injectFilescopes,
          extract: {
            name: vanillaExtractCssName,
            sourcemap: vanillaExtract.options.extract?.sourcemap ?? true,
          },
        }) as unknown as Rolldown.Plugin,
        optimizeCss({
          extractFileName: vanillaExtractCssName,
          browserslist: vanillaExtract.options.browserslist || browserslistConfig,
          minify: vanillaExtract.options.minify ?? true,
        }),
        // In compat mode, emit the no-op JS shim that the `node`/`default` conditions of the
        // `./<css>` export resolve to.
        vanillaExtract.compatMode && bundleCssShim({fileName: `${vanillaExtractCssName}.js`}),
      ]
    : undefined

  // The vanilla-extract plugin resolves each compiled `.css.ts` module's CSS to an external,
  // side-effect-only `<file>.vanilla.css` import and extracts the CSS into a single file. The
  // imports are redundant once the CSS is extracted, so let tree-shaking drop them up front:
  // the plugin's own `generateBundle` cleanup only strips imports at the start of a line, which
  // the minifier's statement merging can defeat (e.g. `a(), require("….vanilla.css")` in CJS).
  // Modules not matching the rule keep the default tree-shaking behavior.
  const treeshake: UserConfig['treeshake'] = vanillaExtract.enabled
    ? {moduleSideEffects: [{test: /\.vanilla\.css$/, external: true, sideEffects: false}]}
    : undefined

  const baseOutputOptions = {
    hoistTransitiveImports: false,
  } as const satisfies UserConfig['outputOptions']

  // In compat mode, the self-referential `import "<pkg>/<css>"` needs the package name.
  const cssImportId = vanillaExtract.compatMode
    ? `${readPackageName(process.cwd())}/${vanillaExtractCssName}`
    : undefined

  const outputOptions: UserConfig['outputOptions'] = vanillaExtract.enabled
    ? (_options, outputFormat, context) => ({
        ...baseOutputOptions,
        // Emit the extracted CSS (and its sourcemap) with a stable name at the root of `outDir`
        // instead of rolldown's default `assets/[name]-[hash][extname]`, so it can back the
        // conditional `./<css>` export.
        assetFileNames: '[name][extname]',
        // In compat mode, inject the self-referential CSS import into the `index` entry chunk so
        // userland does not need to set `outputOptions.intro` themselves. Use `require()` for
        // CommonJS output (a top-level `import` would be invalid in a `.cjs` bundle).
        ...(cssImportId && !context.cjsDts && (outputFormat === 'es' || outputFormat === 'cjs')
          ? {
              intro: composeIntro(
                outputFormat === 'cjs'
                  ? `require(${JSON.stringify(cssImportId)})`
                  : `import ${JSON.stringify(cssImportId)}`,
              ),
            }
          : {}),
      })
    : baseOutputOptions

  const conditionalCssExport = vanillaExtract.compatMode
    ? createConditionalCssExport(vanillaExtractCssName, outDir)
    : undefined

  const exports = {
    enabled: 'local-only',
    // @TODO use @sanity/parse-package-json to determine if devExports should be `true` or `source`
    devExports: true,
    // In compat mode, write the conditional `./<css>` export to `package.json` (and, through
    // tsdown, mirror it into `publishConfig.exports`) so userland does not have to maintain it.
    ...(conditionalCssExport && {
      customExports: (exportsMap: Record<string, unknown>) =>
        insertCssExport(exportsMap, `./${vanillaExtractCssName}`, conditionalCssExport),
    }),
  } as const satisfies UserConfig['exports']

  return defineTsdownConfig({
    entry,
    exports,
    format,
    hash,
    inputOptions,
    outputOptions,
    platform,
    plugins,
    publint,
    report,
    treeshake,
    tsconfig,
    minify: {compress: true, codegen: false, mangle: false},
    // `treeshake` stays `undefined` (tsdown's/rolldown's default, `moduleSideEffects: true`)
    // unless vanilla-extract needs its targeted rule above. Previously this set the equivalent of
    // `moduleSideEffects: 'no-external'` (with a `.css` exemption), which stripped intentional
    // side-effect-only imports of external packages (e.g. `import 'react-time-ago/locale/en'`)
    // from the output. The default preserves those imports while still honoring `package.json`
    // `sideEffects` fields for bundled modules.
  })
}

const RE_DTS = /\.d\.[cm]?ts$/

/**
 * Build an `intro` function that prepends `autoImport` to the `index` entry chunk only. The
 * `.d.ts` chunks generated by tsdown share the build, so they are explicitly excluded.
 */
function composeIntro(autoImport: string): (chunk: Rolldown.RenderedChunk) => string {
  return (chunk) =>
    chunk.isEntry && chunk.name === 'index' && !RE_DTS.test(chunk.fileName) ? `${autoImport}\n` : ''
}

function readPackageName(cwd: string): string {
  const pkgPath = path.resolve(cwd, 'package.json')
  // oxlint-disable-next-line no-unsafe-type-assertion
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {name?: unknown}
  if (typeof pkg.name !== 'string' || !pkg.name) {
    throw new Error(
      `Unable to resolve the package name from ${pkgPath}, which is required by \`vanillaExtract\` compat mode to inject the self-referential CSS import. Set \`vanillaExtract: {extract: {compatMode: false}}\` to wire up the CSS export manually.`,
    )
  }
  return pkg.name
}
