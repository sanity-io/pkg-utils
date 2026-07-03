import {readFileSync} from 'node:fs'
import path from 'node:path'
import type {PluginOptions as ReactCompilerPluginOptions} from 'babel-plugin-react-compiler'
import {defineConfig as defineTsdownConfig, type Rolldown, type UserConfig} from 'tsdown'
import {
  createConditionalCssExport,
  insertCssExport,
  resolveVanillaExtract,
  resolveVanillaExtractCssName,
  type PackageVanillaExtractOptions,
} from './vanillaExtract.ts'

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
export interface PackageOptions extends Pick<UserConfig, 'tsconfig' | 'entry' | 'format'> {
  /**
   * @defaultValue 'neutral'
   */
  platform?: UserConfig['platform']
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
  const {entry} = options
  const tsconfig = options.tsconfig ?? 'tsconfig.json'
  const platform = options.platform ?? 'neutral'
  const reactCompiler = options.reactCompiler ?? false
  const styledComponents = options.styledComponents ?? false
  const report = {gzip: false} as const satisfies UserConfig['report']
  const publint = true
  const hash = false
  const format = options.format ?? 'esm'
  const inputOptions = {
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

  // `outDir` is not configurable (yet), so the tsdown default is a known constant. It is needed to
  // build the conditional CSS export paths below.
  const outDir = 'dist'

  // Resolve vanilla-extract options + the conditional CSS export "compat mode"
  const vanillaExtract = resolveVanillaExtract(options.vanillaExtract)
  const vanillaExtractCssName = resolveVanillaExtractCssName(vanillaExtract.options)

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
      // The plugin types don't match when `@rolldown/plugin-babel` resolves its `rolldown` peer
      // dependency to a different version than the one bundled with `tsdown`, so cast it:
      // https://tsdown.dev/advanced/plugins#rollup-plugins
      // oxlint-disable-next-line no-unsafe-type-assertion
      (await pluginBabel({
        presets: [reactCompilerPreset(typeof reactCompiler === 'object' ? reactCompiler : {})],
      })) as unknown as Rolldown.Plugin,
    )
  }
  if (vanillaExtract.enabled) {
    // The plugin pipeline is lazy loaded, like `reactCompiler`, so `@vanilla-extract/rollup-plugin`
    // and the CSS toolchain (`lightningcss`, `browserslist`) are only paid for when vanilla-extract
    // is enabled.
    const {vanillaExtractPlugins} = await import('./vanillaExtractPlugins.ts')
    plugins.push(...vanillaExtractPlugins(vanillaExtract, vanillaExtractCssName))
  }

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
