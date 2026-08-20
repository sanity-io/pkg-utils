import type {PkgExports} from '@sanity/parse-package-json'
import type {
  PackageBundleAnalyzerOptions,
  PackageCssOptions,
  PackageTsdocCustomTag,
  PackageTsdocOptions,
  PackageTsdocRuleLevel,
  PackageVanillaExtractOptions,
  ReactCompilerConfigOptions,
  StyledComponentsOptions,
} from '@sanity/tsdown-config'
import type {PluginOptions as BabelReactCompilerPluginOptions} from 'babel-plugin-react-compiler'
import type {ReactCompilerOptions as OxcReactCompilerOptions} from 'oxc-transform-react'
import type {UserConfig} from 'tsdown'
import type {StrictOptions} from '../../strict.ts'

export type {PkgExport, PkgExports} from '@sanity/parse-package-json'
export type {
  PackageBundleAnalyzerOptions,
  PackageCssOptions,
  PackageTsdocCustomTag,
  PackageTsdocOptions,
  PackageTsdocRuleLevel,
  PackageVanillaExtractOptions,
  ReactCompilerConfigOptions,
  StyledComponentsOptions,
} from '@sanity/tsdown-config'

// pkg-utils declares its own `ReactCompiler*` shapes instead of re-exporting
// `@sanity/tsdown-config`'s: since 0.27 that config defaults `reactCompiler.transform` to
// `'oxc'` (its babel shape requires an explicit `transform: 'babel'`), while `pkg build`
// keeps `'babel'` as the default implementation — flipping it would break published configs,
// whose compiler package is a peer the package itself installs (`reactCompiler: true`
// projects have `babel-plugin-react-compiler`, not `oxc-transform-react`).
// `resolveTsdownConfig` pins the transform before the options are forwarded.
//
// Both shapes are `interface … extends` (heritage clauses) rather than intersection type
// aliases because the base types come from optional peer dependencies: in consumers that
// don't install one of them, an intersection would degrade to `any` (`skipLibCheck` silences
// the unresolved import inside the emitted declarations) and absorb the whole
// `ReactCompilerOptions` union, while an unresolvable heritage clause is dropped — the shape
// degrades to its own `transform` member and the union keeps discriminating.

/**
 * The default `reactCompiler` shape: `babel-plugin-react-compiler` (an optional peer
 * dependency) runs the compiler, with its own `PluginOptions` — the typings resolve once the
 * package is installed. Until then the compiler options fall away and only `transform` and
 * `reactServer` remain typed.
 * @public
 */
export interface ReactCompilerBabelOptions
  extends Partial<BabelReactCompilerPluginOptions>,
    ReactCompilerConfigOptions {
  /**
   * `babel-plugin-react-compiler`, the reference implementation. The rest of the babel
   * toolchain (`@rolldown/plugin-babel`, `@babel/core`) ships with pkg-utils.
   * @defaultValue 'babel'
   */
  transform?: 'babel'
}

/**
 * The `transform: 'oxc'` shape: `oxc-transform-react` (an optional peer dependency) runs the
 * compiler, with its own `ReactCompilerOptions` — the serializable subset of the babel
 * plugin's (no `logger`, no function-valued `sources`); the typings resolve once the package
 * is installed. Until then the compiler options fall away and only `transform` and
 * `reactServer` remain typed.
 * @public
 */
export interface ReactCompilerOxcOptions
  extends OxcReactCompilerOptions,
    ReactCompilerConfigOptions {
  /**
   * `oxc-transform-react`, the Rust port. Its one native pass also strips TypeScript and
   * lowers JSX (automatic runtime, `react` import source) — stay on `'babel'` with a
   * custom `jsxImportSource`.
   */
  transform: 'oxc'
}

/**
 * Options for the React Compiler: the compiler's own options, plus `transform` (which
 * implementation runs) — handled by `pkg build`, never forwarded to the compiler.
 * @public
 */
export type ReactCompilerOptions = ReactCompilerBabelOptions | ReactCompilerOxcOptions

/** @public */
export type PkgFormat = 'commonjs' | 'esm'

/** @public */
export type PkgRuntime = '*' | 'browser' | 'node'

/** @public */
export type PkgConfigPropertyResolver<T> = (prev: T) => T

/** @public */
export type PkgConfigProperty<T> = PkgConfigPropertyResolver<T> | T

/** @public */
export interface PkgBundle {
  source: string
  import?: string
  require?: string
  runtime?: PkgRuntime
}

/**
 * @public
 * @deprecated Use `PackageTsdocRuleLevel` from `@sanity/pkg-utils`.
 */
export type PkgRuleLevel = PackageTsdocRuleLevel

/**
 * @public
 * @deprecated Use `PackageTsdocCustomTag` from `@sanity/pkg-utils`.
 */
export type TSDocCustomTag = PackageTsdocCustomTag

/**
 * Options for the `tsdoc` option: the `@microsoft/api-extractor` powered TSDoc and release-tag
 * checking that runs during `pkg build` and `pkg check`.
 * @public
 * @deprecated Use `PackageTsdocOptions` from `@sanity/pkg-utils`.
 */
export type PkgTsdocOptions = PackageTsdocOptions

/** @public */
export interface PkgConfigOptions {
  bundles?: PkgBundle[]
  /**
   * Enables Rolldown's experimental
   * [`bundleAnalyzerPlugin`](https://rolldown.rs/builtin-plugins/bundle-analyzer) to emit a
   * report of what the package itself bundles. Pass `true` for the defaults (`format: 'md'`,
   * an LLM-friendly `analyze-data.md` in `dist`), or an options object to customize.
   *
   * Analysis adds work to the build, so this stays off by default — typical usage is an
   * env-gated opt-in:
   *
   * ```ts
   * bundleAnalyzer: process.env.ENABLE_BUNDLE_ANALYZER === 'true'
   * ```
   *
   * The report is **not** a publishable artifact. Exclude it from `package.json` `files`
   * (e.g. `"!dist/analyze-data.md"`) so an accidental analyze build cannot ship it.
   * @defaultValue false
   * @alpha This option wraps Rolldown's experimental analyzer, whose API may change.
   */
  bundleAnalyzer?: boolean | PackageBundleAnalyzerOptions
  /**
   * tsdown's `clean` option, passed through as-is. Cleaning is on by default: `true` (the
   * default) cleans the `dist` folder before the build, `false` skips cleaning, and a
   * `string[]` replaces the default with the listed paths/globs — include `dist` when you
   * still want it cleaned alongside other folders (e.g. `clean: ['dist', 'coverage']`
   * replaces a `"clean": "rimraf dist coverage"` script).
   * @defaultValue true
   */
  clean?: UserConfig['clean']
  /**
   * Enables the `@tsdown/css` pipeline (requires `@tsdown/css` to be installed): plain CSS,
   * CSS modules, preprocessors, Lightning CSS / PostCSS. The emitted CSS is minified and
   * lowered with the same settings as {@link PkgConfigOptions.vanillaExtract | `vanillaExtract`},
   * and gets the same conditional CSS export treatment — the self-referential
   * `import "<pkg>/style.css"`, a no-op `style-css.js` shim with its `style-css.d.ts`
   * declaration, and the conditional `"./style.css"` export written to `package.json`.
   *
   * It is enabled automatically (with these defaults) for a package that declares a `.css`
   * export subpath with a `source`, e.g.
   *
   * ```json
   * "./ui/styles.css": {"source": "./src/ui/styles.css"}
   * ```
   *
   * which builds `./src/ui/styles.css` to `dist/ui/styles.css` and fills in the remaining
   * export conditions. Set the option explicitly to customize the pipeline.
   * @alpha
   */
  css?: PackageCssOptions
  /** @alpha */
  define?: Record<string, string | number | boolean | undefined | null>
  /**
   * tsdown's `deps` option, passed through as-is: `neverBundle` marks dependencies as external
   * (the successor of the deprecated `external` array), `alwaysBundle` forces a dependency to
   * be inlined (the successor of the `external` callback pattern that filtered a dependency
   * out of the externals).
   * @see https://tsdown.dev/options/dependencies
   */
  deps?: UserConfig['deps']
  /**
   * Directory of distributed & bundled files.
   */
  dist?: string
  /**
   * tsdown's `dts` options, passed through as-is (an object, or `false` to skip generating
   * `.d.ts` files entirely). For example `dts: {tsgo: true}` selects the Go-native TypeScript
   * compiler for type generation.
   * @see https://tsdown.dev/options/dts
   */
  dts?: false | Extract<NonNullable<UserConfig['dts']>, object>
  exports?: PkgConfigProperty<PkgExports>
  /**
   * Packages to exclude from bundles.
   * Provide an array to merge with default exclusions, use a function to replace them:
   * ```
   * external: (prev) => prev.filter(package => package !== 'foo')
   * ```
   * @deprecated Use `deps: {neverBundle: [...]}` to mark dependencies as external, and
   * `deps: {alwaysBundle: [...]}` to bundle a dependency (the callback pattern that filtered
   * entries out of the defaults). `external` still works but logs a warning on every build.
   */
  external?: PkgConfigProperty<string[]>
  /**
   * Gates the legacy-config migration checks (the runtime errors and warnings for options that
   * were removed or deprecated in v12). Defaults to on outside production builds, where
   * migration mistakes surface during development, and off when `NODE_ENV=production` so the
   * validation adds no overhead to production builds.
   * @defaultValue `process.env.NODE_ENV !== 'production'`
   */
  legacyChecks?: boolean
  /**
   * Fully minify the output (identifier mangling and whitespace removal included). Off by
   * default: the output is always compressed (constant folding, dead code elimination) with
   * function/class names preserved, and consumers' production builds minify `node_modules`
   * again anyway.
   * @defaultValue false
   */
  minify?: boolean
  /**
   * Extra rolldown plugins, appended after the plugins pkg-utils sets up (React Compiler,
   * vanilla-extract, bundle analyzer). Most Rollup plugins are also compatible.
   * @see https://tsdown.dev/advanced/plugins
   * @alpha
   */
  plugins?: UserConfig['plugins']
  /**
   * Runs the React Compiler on the source files before they are bundled, so published
   * components are memoized automatically. Pass `true` to use the defaults, or an options
   * object (e.g. `{target: '18'}`). `transform` picks the implementation: `'babel'`
   * (default, requires `babel-plugin-react-compiler` — the rest of the babel toolchain ships
   * with pkg-utils) or `'oxc'` (requires `oxc-transform-react`, the Rust port). Unlike
   * `@sanity/tsdown-config` (which defaults to `'oxc'` since 0.27), pkg-utils keeps `'babel'`
   * as the default implementation.
   */
  reactCompiler?: boolean | ReactCompilerOptions
  /**
   * Default runtime of package exports
   */
  runtime?: PkgRuntime
  sourcemap?: boolean
  /**
   * Directory of source files.
   */
  src?: string
  /**
   * Configure what checks are made when running `--strict` builds and checks
   */
  strictOptions?: Partial<StrictOptions>
  /**
   * Applies the `styled-components` transform (`displayName`, `componentId`, CSS minification,
   * etc) using oxc's native port of `babel-plugin-styled-components` — no Babel dependencies
   * required. Pass `true` for the defaults, or an options object to customize.
   * @defaultValue false
   */
  styledComponents?: boolean | StyledComponentsOptions
  tsconfig?: string
  /**
   * Runs `@microsoft/api-extractor` to check that TSDoc tags are valid and release tags are
   * correct. Enabled during `pkg build` and again during `pkg check`. Set `tsdoc: false` to
   * disable it.
   * @defaultValue true
   */
  tsdoc?: boolean | PackageTsdocOptions
  /**
   * Enables `@sanity/vanilla-extract-tsdown-plugin` to extract CSS from `.css.ts` files into a
   * separate file (`dist/bundle.css` by default), minified and lowered with `lightningcss`.
   * By default the conditional CSS export pattern is wired up automatically: the
   * self-referential `import "<pkg>/bundle.css"` is injected into the entry chunks, a no-op
   * `bundle-css.js` shim is emitted, and the conditional `"./bundle.css"` export is written to
   * `package.json`. Pass `true` for the defaults, or an options object to customize.
   * @alpha
   */
  vanillaExtract?: boolean | PackageVanillaExtractOptions

  // --- Tombstones for options removed in v12. They stay declared (typed `never`, tagged
  // `@deprecated`) so editors surface the migration path instead of "unknown property", and
  // `loadConfig` throws a helpful error when they are set at runtime (JS configs bypass the
  // types). Gated by `legacyChecks`.

  /**
   * @deprecated Removed in v12. `babel.reactCompiler` is the top-level `reactCompiler` option,
   * `babel.styledComponents` is the top-level `styledComponents` option (now an oxc native
   * transform — `babel-plugin-styled-components` can be uninstalled), and custom Babel plugins
   * run through the `plugins` option with a self-installed `@rolldown/plugin-babel`.
   */
  babel?: never
  /**
   * @deprecated Removed in v12. TSDoc/release-tag checking is configured with the top-level
   * `tsdoc` option (`extract: {enabled: false}` becomes `tsdoc: false`; `rules` and
   * `customTags` carry over unchanged). Type inlining (`extract.bundledPackages`) is
   * `dts: {resolve: [...]}`. `extract.checkTypes` has no successor — type generation no longer
   * type-checks.
   */
  extract?: never
  /**
   * @deprecated Removed in v12. Configure JSX through `tsconfig.json` (`compilerOptions.jsx`,
   * `jsxFactory`, `jsxFragmentFactory`, `jsxImportSource`) — the bundler reads it from there.
   */
  jsx?: never
  /**
   * @deprecated Removed in v12. Configure JSX through `tsconfig.json`
   * (`compilerOptions.jsxFactory`).
   */
  jsxFactory?: never
  /**
   * @deprecated Removed in v12. Configure JSX through `tsconfig.json`
   * (`compilerOptions.jsxFragmentFactory`).
   */
  jsxFragment?: never
  /**
   * @deprecated Removed in v12. Configure JSX through `tsconfig.json`
   * (`compilerOptions.jsxImportSource`).
   */
  jsxImportSource?: never
  /**
   * @deprecated Removed in v12. Pass the compiler options to `reactCompiler` instead:
   * `reactCompiler: {target: '18'}`.
   */
  reactCompilerOptions?: never
  /**
   * @deprecated Removed in v12. `rollup.vanillaExtract` is the top-level `vanillaExtract`
   * option, and `rollup.plugins` is the top-level `plugins` option (rolldown plugins; most
   * Rollup plugins are compatible). `rollup.output`, `rollup.treeshake`,
   * `rollup.experimentalLogSideEffects`, `rollup.hashChunkFileNames` and
   * `rollup.optimizeLodash` have no successor.
   */
  rollup?: never
  /**
   * @deprecated Removed in v12. Set `dts: {tsgo: true}` instead — the `dts` option is passed
   * through to tsdown as-is.
   */
  tsgo?: never
}
