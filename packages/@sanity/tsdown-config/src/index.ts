import type {Options as VanillaExtractPluginOptions} from '@sanity/vanilla-extract-tsdown-plugin'
import type {PluginOptions as ReactCompilerPluginOptions} from 'babel-plugin-react-compiler'
import {
  defineConfig as defineTsdownConfig,
  type NormalizedFormat,
  type Rolldown,
  type UserConfig,
} from 'tsdown'

/**
 * Options for the `vanillaExtract` option — the same options as
 * `@sanity/vanilla-extract-tsdown-plugin` (`identifiers`, `fileName`, `minify`, `target`, and
 * `inject`, all modeled after the `css` options of `@tsdown/css`).
 * @public
 */
export type PackageVanillaExtractOptions = VanillaExtractPluginOptions

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
  'tsconfig' | 'entry' | 'format' | 'dts' | 'define' | 'target'
> {
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
   * Enables `@sanity/vanilla-extract-tsdown-plugin` to extract CSS into a separate,
   * `lightningcss`-optimized file. Pass `true` to use the defaults, or an object to customize.
   *
   * By default (`inject: true`) the plugin also injects the self-referential
   * `import "<pkg>/bundle.css"` and emits a `bundle.css.js` shim, and the config writes the
   * conditional `"./bundle.css"` export to `package.json` - see
   * {@link PackageVanillaExtractOptions}. This is the same feature as `rollup.vanillaExtract`
   * in `@sanity/pkg-utils`.
   * @alpha
   */
  vanillaExtract?: boolean | PackageVanillaExtractOptions
}

/**
 * Emits shared (non-entry) chunks into subfolders per output flavor, following the same naming
 * convention as `@sanity/pkg-utils` (`_chunks-es`, `_chunks-cjs` and `_chunks-dts`), instead of
 * rolldown's default of placing chunks at the root of the output directory next to the entries.
 * A chunk can otherwise be named like an entry (e.g. code shared between `index` and `theme`
 * entries forms a chunk that rolldown also names `theme`): the JS output deduplicates such
 * filename collisions in favor of the entry, but the d.ts output can resolve them the other way
 * around, handing `theme.d.ts` to the chunk - which re-exports everything under minified aliases -
 * so every named import from the `theme` entry fails to type-check with TS2460
 * (https://github.com/sanity-io/ui/issues/2262).
 */
function resolveChunkFileNames(
  defaultOutputOptions: Rolldown.OutputOptions,
  format: NormalizedFormat,
): Rolldown.OutputOptions['chunkFileNames'] {
  return (chunk) => {
    // tsdown's default is a `[name]` template string carrying the resolved output extension for
    // the current format and package type (e.g. `[name].mjs`), so reuse it for the file names
    const template =
      (typeof defaultOutputOptions.chunkFileNames === 'function'
        ? defaultOutputOptions.chunkFileNames(chunk)
        : defaultOutputOptions.chunkFileNames) ?? '[name].js'
    // `rolldown-plugin-dts` names d.ts chunks with a `.d` suffix and later rewrites the rendered
    // JS filename to the matching d.ts extension (e.g. `_chunks-dts/[name].mjs` renders
    // `_chunks-dts/theme.mjs`, which becomes `_chunks-dts/theme.d.mts`)
    const folder = chunk.name.endsWith('.d') ? '_chunks-dts' : `_chunks-${format}`
    return `${folder}/${template}`
  }
}

/**
 * @public
 */
export async function defineConfig(options: PackageOptions = {}): Promise<UserConfig> {
  // `dts`, `define` and `target` are passed through to tsdown as-is. When left undefined, tsdown
  // keeps its default behavior (`dts` is auto-detected from `package.json`, `define` replaces
  // nothing, and `target` applies no syntax downleveling).
  const {entry, dts, define, target} = options
  const tsconfig = options.tsconfig ?? 'tsconfig.json'
  const platform = options.platform ?? 'neutral'
  const reactCompiler = options.reactCompiler ?? false
  const styledComponents = options.styledComponents ?? false
  const report = {gzip: false} as const satisfies UserConfig['report']
  const publint = true
  const hash = false
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

  const resolveBaseOutputOptions = (
    defaultOptions: Rolldown.OutputOptions,
    outputFormat: NormalizedFormat,
  ) =>
    ({
      chunkFileNames: resolveChunkFileNames(defaultOptions, outputFormat),
    }) satisfies Rolldown.OutputOptions

  const outputOptions: UserConfig['outputOptions'] = resolveBaseOutputOptions

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
    // Lazy loaded, like `reactCompiler`, so the CSS toolchain is only paid for when the option is
    // enabled. The plugin owns the whole conditional CSS export pattern: it compiles the `.css.ts`
    // files, extracts the CSS into a single `lightningcss`-optimized file, and (with `inject`, the
    // default) injects the self-referential CSS import, emits the no-op JS shim, and writes the
    // conditional `./<fileName>` export through this config's `exports` option (which its
    // `tsdownConfig` hook composes into).
    const {vanillaExtractPlugin} = await import('@sanity/vanilla-extract-tsdown-plugin')
    plugins.push(
      vanillaExtractPlugin(options.vanillaExtract === true ? {} : options.vanillaExtract),
    )
  }

  const exports = {
    enabled: 'local-only',
    // @TODO use @sanity/parse-package-json to determine if devExports should be `true` or `source`
    devExports: true,
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
    target,
    tsconfig,
    minify: {compress: true, codegen: false, mangle: false},
    // `treeshake` is left at tsdown's/rolldown's default (`moduleSideEffects: true`). Previously
    // this set the equivalent of `moduleSideEffects: 'no-external'` (with a `.css` exemption),
    // which stripped intentional side-effect-only imports of external packages (e.g.
    // `import 'react-time-ago/locale/en'`) from the output. The default preserves those imports
    // while still honoring `package.json` `sideEffects` fields for bundled modules.
  })
}
