import type {PluginOptions as ReactCompilerPluginOptions} from 'babel-plugin-react-compiler'
import {defineConfig as defineTsdownConfig, type Rolldown, type UserConfig} from 'tsdown'
import type {PackageVanillaExtractOptions} from './vanillaExtract.ts'

export type {PackageVanillaExtractOptions}

/**
 * Options for the `styled-components` transform, the same options as `babel-plugin-styled-components`.
 * @public
 */
export interface StyledComponentsOptions {
  /** @defaultValue true */
  displayName?: boolean
  /**
   * @defaultValue []
   * @example ["\@xstyled/styled-components", "\@xstyled/styled-components/*"]
   */
  topLevelImportPaths?: string[]
  /** @defaultValue true */
  ssr?: boolean
  /** @defaultValue false */
  fileName?: boolean
  /** @defaultValue ["index"] */
  meaninglessFileNames?: string[]
  /** @defaultValue true */
  minify?: boolean
  /** @defaultValue false */
  transpileTemplateLiterals?: boolean
  namespace?: string
  /** @defaultValue true */
  pure?: boolean
}

/**
 * Options for the React Compiler, the same options as `babel-plugin-react-compiler`.
 * The typings resolve in userland once `babel-plugin-react-compiler` (an optional peer
 * dependency, required to use `reactCompiler`) is installed, and always match the installed
 * version of the compiler.
 * @public
 */
export type ReactCompilerOptions = Partial<ReactCompilerPluginOptions>

/**
 * @public
 */
export interface PackageOptions extends Pick<
  UserConfig,
  'tsconfig' | 'entry' | 'format' | 'dts' | 'define'
> {
  /**
   * @defaultValue 'neutral'
   */
  platform?: UserConfig['platform']
  /**
   * Appends a content hash to shared (non-entry) chunk filenames (`[name]-[hash].<ext>`), passed
   * through to tsdown as-is and left at tsdown's default (`true`) when undefined. The hash keeps
   * a chunk from ever taking an entry's filename: code shared between entries forms a chunk that
   * rolldown can name after one of the entries (e.g. `theme`), and without the hash the d.ts
   * output could hand `theme.d.ts` to the chunk - which re-exports everything under minified
   * aliases - breaking every named import from the `theme` entry with TS2460
   * (https://github.com/sanity-io/ui/issues/2262). Only set this to `false` if entries and
   * chunks can't collide (e.g. a single-entry package) or `outputOptions.chunkFileNames` keeps
   * chunks away from the entries.
   * @defaultValue true
   */
  hash?: UserConfig['hash']
  /**
   * Runs `babel-plugin-react-compiler` on the source files before they are bundled, so published
   * components are memoized automatically. Pass `true` to use the defaults, or an options object
   * to configure the compiler (e.g. `{target: '18'}`).
   * This is the same feature as the `babel: {reactCompiler: true}` and `reactCompilerOptions`
   * options in `@sanity/pkg-utils`. Unlike `styledComponents` there's no oxc native port of the
   * React Compiler yet, so `babel-plugin-react-compiler` needs to be installed.
   * @defaultValue false
   */
  reactCompiler?: boolean | ReactCompilerOptions
  /**
   * Applies the `styled-components` transform (`displayName`, `componentId`, CSS minification, etc)
   * with the same defaults as the `babel: {styledComponents: true}` option in `@sanity/pkg-utils`.
   * Unlike `@sanity/pkg-utils` it doesn't use `babel-plugin-styled-components`, but oxc's native port of it,
   * so there's no need to install babel dependencies.
   * @defaultValue false
   */
  styledComponents?: boolean | StyledComponentsOptions
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
export async function defineConfig(options: PackageOptions = {}): Promise<UserConfig> {
  // `dts`, `define` and `hash` are passed through to tsdown as-is. When left undefined, tsdown
  // keeps its default behavior (`dts` is auto-detected from `package.json`, `define` replaces
  // nothing, `hash` appends content hashes to shared chunk filenames).
  const {entry, dts, define, hash} = options
  const tsconfig = options.tsconfig ?? 'tsconfig.json'
  const platform = options.platform ?? 'neutral'
  const reactCompiler = options.reactCompiler ?? false
  const styledComponents = options.styledComponents ?? false
  const report = {gzip: false} as const satisfies UserConfig['report']
  const publint = true
  const format = options.format ?? 'esm'
  const inputOptions = {
    // https://github.com/rolldown/rolldown/blob/main/packages/rolldown/src/options/docs/preserve-entry-signatures.md#strict
    preserveEntrySignatures: 'strict',
    experimental: {attachDebugInfo: 'none'},
    ...(styledComponents !== false && {
      transform: {
        plugins: {
          styledComponents: {
            // The same defaults as `babel: {styledComponents: true}` in `@sanity/pkg-utils`:
            // `fileName` is unnecessary, as the way we use styled-components in Sanity is usually by wrapping
            // `@sanity/ui` primitives, not declaring new ones like "const Button = styled.button``"
            fileName: false,
            // Native template literals take less space than this transpilation, and unlike
            // `babel-plugin-styled-components`, oxc doesn't add a `@__PURE__` annotation to the
            // transpiled call expression either, so enabling it wouldn't improve tree-shaking
            transpileTemplateLiterals: false,
            // Helps dead code elimination and tree-shaking, although oxc only annotates plain call
            // expressions so far, not tagged template expressions (https://github.com/rollup/rollup/issues/4035)
            pure: true,
            // Disabled, as tsdown tends to be used for npm publishing, while other tooling,
            // like `sanity dev`, `next dev`, etc are used for testing
            cssProp: false,
            ...(typeof styledComponents === 'object' ? styledComponents : {}),
          },
        },
      },
    }),
  } as const satisfies UserConfig['inputOptions']

  // `outputOptions` stays undefined (tsdown's defaults) unless vanilla-extract needs its wiring
  // below - notably chunk filenames keep tsdown's hashed default, which prevents chunk/entry
  // filename collisions (see the `hash` option on `PackageOptions`).
  let outputOptions: UserConfig['outputOptions']
  let treeshake: UserConfig['treeshake']
  let customExports: ((exportsMap: Record<string, unknown>) => Record<string, unknown>) | undefined

  const plugins: Rolldown.Plugin[] = []
  if (reactCompiler !== false) {
    // Follows the official tsdown recipe for the React Compiler:
    // https://tsdown.dev/recipes/react-support#enabling-react-compiler
    // The plugins are lazy loaded so they're only paid for when the React Compiler is enabled.
    // `babel-plugin-react-compiler` itself is resolved by Babel from the consumer package during
    // the build, which is why it can be an optional peer dependency. Once rolldown ships its rust
    // port of the React Compiler this can be swapped out for an oxc transform, like `styledComponents`.
    const [{default: pluginBabel}, {reactCompilerPreset}] = await Promise.all([
      import('@rolldown/plugin-babel'),
      import('@vitejs/plugin-react'),
    ])
    plugins.push(
      await pluginBabel({
        presets: [reactCompilerPreset(typeof reactCompiler === 'object' ? reactCompiler : {})],
      }),
    )
  }
  if (options.vanillaExtract) {
    // Everything vanilla-extract related is lazy loaded, like `reactCompiler`, so it's only paid
    // for when the option is enabled: `@vanilla-extract/rollup-plugin` compiles the `.css.ts`
    // files, and `optimizeCss` pulls in the CSS toolchain (`lightningcss`, `browserslist`) that
    // minifies the extracted CSS.
    const [
      {vanillaExtractPlugin},
      {default: browserslistConfig},
      {optimizeCss},
      {bundleCssShim},
      {
        composeIntro,
        createConditionalCssExport,
        insertCssExport,
        readPackageName,
        resolveVanillaExtract,
        resolveVanillaExtractCssName,
      },
    ] = await Promise.all([
      import('@vanilla-extract/rollup-plugin'),
      import('@sanity/browserslist-config'),
      import('./optimizeCss.ts'),
      import('./bundleCssShim.ts'),
      import('./vanillaExtract.ts'),
    ])

    // Resolve vanilla-extract options + the conditional CSS export "compat mode"
    const vanillaExtract = resolveVanillaExtract(options.vanillaExtract)
    const cssName = resolveVanillaExtractCssName(vanillaExtract.options)

    plugins.push(
      // Rolldown supports most Rollup plugins, but the plugin types are not identical, so the
      // official guidance is to cast: https://tsdown.dev/advanced/plugins#rollup-plugins
      // oxlint-disable-next-line no-unsafe-type-assertion
      vanillaExtractPlugin({
        identifiers: vanillaExtract.options.identifiers ?? 'short',
        cwd: vanillaExtract.options.cwd,
        esbuildOptions: vanillaExtract.options.esbuildOptions,
        unstable_injectFilescopes: vanillaExtract.options.unstable_injectFilescopes,
        extract: {
          name: cssName,
          sourcemap: vanillaExtract.options.extract?.sourcemap ?? true,
        },
      }) as unknown as Rolldown.Plugin,
      optimizeCss({
        extractFileName: cssName,
        browserslist: vanillaExtract.options.browserslist || browserslistConfig,
        minify: vanillaExtract.options.minify ?? true,
      }),
    )

    // The vanilla-extract plugin resolves each compiled `.css.ts` module's CSS to an external,
    // side-effect-only `<file>.vanilla.css` import and extracts the CSS into a single file. The
    // imports are redundant once the CSS is extracted, so let tree-shaking drop them up front:
    // the plugin's own `generateBundle` cleanup only strips imports at the start of a line, which
    // the minifier's statement merging can defeat (e.g. `a(), require("….vanilla.css")` in CJS).
    // Modules not matching the rule keep the default tree-shaking behavior.
    treeshake = {moduleSideEffects: [{test: /\.vanilla\.css$/, external: true, sideEffects: false}]}

    // In compat mode, the self-referential `import "<pkg>/<css>"` needs the package name.
    const cssImportId = vanillaExtract.compatMode
      ? `${readPackageName(process.cwd())}/${cssName}`
      : undefined

    outputOptions = (_defaultOptions, outputFormat, context) => ({
      // Emit the extracted CSS (and its sourcemap) with a stable name at the root of the tsdown
      // default `outDir` ('dist', not configurable yet) instead of rolldown's default
      // `assets/[name]-[hash][extname]`, so it can back the conditional `./<css>` export.
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

    if (vanillaExtract.compatMode) {
      // In compat mode, emit the no-op JS shim that the `node`/`default` conditions of the
      // `./<css>` export resolve to.
      plugins.push(bundleCssShim({fileName: `${cssName}.js`}))

      // Write the conditional `./<css>` export to `package.json` (and, through tsdown, mirror it
      // into `publishConfig.exports`) so userland does not have to maintain it.
      const conditionalCssExport = createConditionalCssExport(cssName, 'dist')
      customExports = (exportsMap) =>
        insertCssExport(exportsMap, `./${cssName}`, conditionalCssExport)
    }
  }

  const exports = {
    enabled: 'local-only',
    // @TODO use @sanity/parse-package-json to determine if devExports should be `true` or `source`
    devExports: true,
    ...(customExports && {customExports}),
  } as const satisfies UserConfig['exports']

  return defineTsdownConfig({
    define,
    dts,
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
