import type {Options as VanillaExtractPluginOptions} from '@sanity/vanilla-extract-tsdown-plugin'
import type {PluginOptions as ReactCompilerPluginOptions} from 'babel-plugin-react-compiler'
import {detect} from 'package-manager-detector/detect'
import {
  defineConfig as defineTsdownConfig,
  mergeConfig,
  type Rolldown,
  type UserConfig,
} from 'tsdown'

/**
 * Options for the `vanillaExtract` option — the same options as
 * `@sanity/vanilla-extract-tsdown-plugin` (`identifiers`, `fileName`, `minify`, `target`,
 * `lightningcss`, and `inject`, all modeled after the `css` options of `@tsdown/css`), with two
 * Sanity-flavored defaults on top:
 *
 * - `inject` defaults to `{nodeCompat: true}` (instead of the plugin's `false`), wiring up the
 *   conditional CSS export pattern that Sanity libraries ship with. Set `inject: true` for a
 *   plain relative CSS import, or `inject: false` to only extract the CSS.
 * - When the effective CSS syntax lowering target (`target`, falling back to the top-level
 *   `target`) is undefined or names no browsers (e.g. `'node20'`, resolved from
 *   `engines.node`), the lowering targets are resolved from `@sanity/browserslist-config` and
 *   passed through `lightningcss.targets` — where the plugin (like `@tsdown/css`) would skip
 *   lowering. `target: false` stays the explicit off switch, and a user-provided
 *   `lightningcss.targets` wins over the fallback.
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
   * tsdown's `exports` option, with defaults suited for publishing Sanity libraries:
   * `enabled: 'local-only'` generates the `exports` map during local builds and skips it in CI
   * (where the committed `package.json` is already up to date). When pnpm is detected,
   * `devExports: true` also keeps the local `exports` map pointing at source files while
   * `publishConfig.exports` receives the built files.
   *
   * Userland values apply with tsdown's `mergeConfig` semantics: an object deep-merges over
   * these defaults (so individual fields can be overridden), while any other value - `false`
   * to disable exports generation, or a bare CI condition (`'ci-only'`/`'local-only'`) -
   * replaces them entirely.
   * @defaultValue `{enabled: 'local-only', devExports: true}` for pnpm projects;
   * `{enabled: 'local-only'}` otherwise.
   */
  exports?: UserConfig['exports']
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
   * Enables `@sanity/vanilla-extract-tsdown-plugin` to extract CSS into a separate file,
   * lowered with `lightningcss` for the `@sanity/browserslist-config` targets by default.
   * Pass `true` to use the defaults, or an object to customize.
   *
   * By default (`inject: {nodeCompat: true}`) the plugin also injects the self-referential
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
  // `tsconfig`, `entry`, `dts`, `define` and `target` are passed through to tsdown as-is. When
  // left undefined, tsdown keeps its default behavior (`tsconfig` is auto-detected from the
  // project, `dts` from `package.json`, `define` replaces nothing, and `target` applies no
  // syntax downleveling).
  const {entry, tsconfig, dts, define, target} = options
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

  // `outputOptions` is left to tsdown's defaults - notably chunk filenames keep tsdown's hashed
  // default (unless userland sets `hash`), which prevents chunk/entry filename collisions
  // (https://github.com/sanity-io/ui/issues/2262).
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
    // enabled. The plugin compiles the `.css.ts` files and extracts the CSS into a single file.
    // Its `inject` option is general purpose (and, like `css.inject` in `@tsdown/css`, disabled
    // by default), so this config supplies the default most Sanity libraries want:
    // `{nodeCompat: true}` wires up the whole conditional CSS export pattern - the
    // self-referential CSS import, the no-op JS shim, and the conditional `./<fileName>` export
    // written through this config's `exports` option (which the plugin's `tsdownConfig` hook
    // composes into).
    const {esbuildTargetToLightningCSS, vanillaExtractPlugin} =
      await import('@sanity/vanilla-extract-tsdown-plugin')
    const vanillaExtract = options.vanillaExtract === true ? {} : options.vanillaExtract

    // The plugin follows `@tsdown/css`: without browser targets, CSS syntax lowering is
    // skipped. The extracted CSS always runs in browsers, so when the effective target
    // (`vanillaExtract.target`, falling back to the top-level `target`) is undefined or names
    // no browsers (e.g. `'node20'` - also what tsdown derives from `engines.node`, which
    // speaks to the JS runtime), this config resolves the lowering targets from
    // `@sanity/browserslist-config` and passes them through `lightningcss.targets` instead.
    // `target: false` stays the explicit off switch, and a user-provided
    // `lightningcss.targets` wins over the fallback.
    const cssTarget = vanillaExtract.target ?? target
    let {lightningcss} = vanillaExtract
    if (
      cssTarget !== false &&
      !lightningcss?.targets &&
      (cssTarget === undefined || !esbuildTargetToLightningCSS(cssTarget))
    ) {
      // Lazy loaded as well: `browserslistToTargets` is a pure helper, but `lightningcss` is a
      // native package that only needs to load when the fallback applies
      const [{default: browserslist}, {default: browserslistConfig}, {browserslistToTargets}] =
        await Promise.all([
          import('browserslist'),
          import('@sanity/browserslist-config'),
          import('lightningcss'),
        ])
      lightningcss = {
        ...lightningcss,
        targets: browserslistToTargets(browserslist(browserslistConfig)),
      }
    }

    plugins.push(
      vanillaExtractPlugin({
        inject: {nodeCompat: true},
        ...vanillaExtract,
        lightningcss,
      }),
    )
  }

  const packageManager = await detect({cwd: process.cwd()})
  // tsdown's `exports` feature is enabled with Sanity-flavored defaults, and userland values
  // apply with tsdown's own `mergeConfig` semantics: an object deep-merges over the defaults,
  // anything else (`false`, a CI condition) replaces them.
  const {exports} = mergeConfig(
    {
      exports: {
        enabled: 'local-only',
        // Only opt in by default when pnpm is detected: support for replacing package fields
        // from `publishConfig` is not reliable across package managers.
        ...(packageManager?.name === 'pnpm' && {devExports: true}),
      },
    },
    {exports: options.exports},
  )

  return defineTsdownConfig({
    define,
    dts,
    entry,
    exports,
    format,
    inputOptions,
    platform,
    plugins,
    publint,
    report,
    target,
    tsconfig,
    minify: {compress: true, codegen: false, mangle: false},
  })
}
