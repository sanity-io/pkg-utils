import type {PkgExports} from '@sanity/parse-package-json'
import type {
  PackageTsdocCustomTag,
  PackageTsdocOptions,
  PackageTsdocRuleLevel,
  PackageVanillaExtractOptions,
  ReactCompilerOptions,
  StyledComponentsOptions,
} from '@sanity/tsdown-config'
import type {UserConfig} from 'tsdown'
import type {StrictOptions} from '../../strict.ts'

export type {PkgExport, PkgExports} from '@sanity/parse-package-json'
export type {
  PackageTsdocCustomTag,
  PackageTsdocOptions,
  PackageTsdocRuleLevel,
  PackageVanillaExtractOptions,
  ReactCompilerOptions,
  StyledComponentsOptions,
} from '@sanity/tsdown-config'

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
   * tsdown's `clean` option, passed through as-is. Cleaning is on by default: `true` (the
   * default) cleans the `dist` folder before the build, `false` skips cleaning, and a
   * `string[]` replaces the default with the listed paths/globs — include `dist` when you
   * still want it cleaned alongside other folders (e.g. `clean: ['dist', 'coverage']`
   * replaces a `"clean": "rimraf dist coverage"` script).
   * @defaultValue true
   */
  clean?: UserConfig['clean']
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
   * vanilla-extract). Most Rollup plugins are also compatible.
   * @see https://tsdown.dev/advanced/plugins
   * @alpha
   */
  plugins?: UserConfig['plugins']
  /**
   * Runs `babel-plugin-react-compiler` on the source files before they are bundled, so
   * published components are memoized automatically. Pass `true` to use the defaults, or an
   * options object to configure the compiler (e.g. `{target: '18'}`). Requires
   * `babel-plugin-react-compiler` to be installed.
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
