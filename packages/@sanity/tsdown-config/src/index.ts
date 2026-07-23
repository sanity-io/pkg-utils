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
 * `lightningcss`, and `inject`, all modeled after the `css` options of `@tsdown/css`), with
 * three Sanity-flavored defaults on top:
 *
 * - `inject` defaults to `{nodeCompat: true}` (instead of the plugin's `false`), wiring up the
 *   conditional CSS export pattern that Sanity libraries ship with. Set `inject: true` for a
 *   plain relative CSS import, or `inject: false` to only extract the CSS.
 * - `minify` defaults to `true` (instead of the plugin's `false`, which matches `css.minify`
 *   in `@tsdown/css`): published Sanity libraries ship minified CSS. Set `minify: false` for
 *   readable output.
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
 *
 * On top of the compiler's own options, `reactServer` opts into the dual React Server
 * Components build — it's handled by this config and never forwarded to
 * `babel-plugin-react-compiler`.
 * @public
 */
export type ReactCompilerOptions = Partial<ReactCompilerPluginOptions> & {
  /**
   * Also emit an uncompiled build of every entry (`<name>.server.js` next to `<name>.js`),
   * wired to the `react-server` export condition in `package.json`:
   *
   * ```json
   * ".": {
   *   "react-server": "./dist/index.server.js",
   *   "default": "./dist/index.js"
   * }
   * ```
   *
   * React Server Components refuse to load React Compiler output (`react/compiler-runtime`
   * throws in the `react-server` environment), so a library that ships compiled code
   * publishes two entrypoints: the compiled one (the `default` condition) and an uncompiled
   * one (the `react-server` condition) — see
   * https://github.com/facebook/react/issues/31702.
   *
   * Both builds come from the same source, and the only difference is that React Compiler
   * auto-memoization is applied to the non-`react-server` output; nothing is stripped from
   * either output. Pair it with deleting manual `useMemo`/`useCallback` calls from the
   * source: server components stop paying for memoization that can never pay off (they
   * render exactly once), and client components get the compiler's finer-grained
   * memoization instead.
   * @defaultValue false
   * @alpha This option is experimental and not covered by semver: it can change behavior or
   * be removed entirely in a minor version.
   */
  reactServer?: boolean
}

/**
 * @public
 */
export interface PackageOptions extends Pick<
  UserConfig,
  'tsconfig' | 'entry' | 'format' | 'dts' | 'define' | 'target' | 'outDir'
> {
  /**
   * @defaultValue 'neutral'
   *
   * When left at `'neutral'` (the default), two resolution tweaks compensate for rolldown's
   * strict neutral defaults: `deps.neverBundle` includes `/^node:/` (node built-ins stay external
   * so neutral does not warn about them as unresolvable; only node runtimes execute those code
   * paths), and `inputOptions.resolve.mainFields` falls back to `['module', 'main']` for inlined
   * dependencies that ship no `exports` map (e.g. `rxjs-etc/operators`). Prefer `'neutral'` over
   * `'node'` for packages that also run in the browser - `'node'` makes CommonJS-interop emit a
   * module-scope `createRequire(import.meta.url)` for inlined CJS deps, which crashes
   * browser-bundled consumers.
   */
  platform?: UserConfig['platform']
  /**
   * Clean directories before each build. Prefer an array of folders over a separate `"clean"`
   * script in `package.json` (e.g. `rimraf dist coverage`) — tsdown removes them as part of
   * `tsdown` / `pnpm build`, so packages don't need `rimraf`, a `clean` script, or
   * `prebuild`/`run-s clean build` wiring.
   *
   * - `true` (tsdown's default when left undefined) cleans `outDir` (`'dist'` by default)
   * - `false` skips cleaning
   * - a `string[]` replaces that default with the listed paths/globs — include `outDir` (e.g.
   *   `'dist'`) when you still want it cleaned alongside other folders
   *
   * @defaultValue true
   * @example
   * ```ts
   * // Instead of `"clean": "rimraf dist coverage"` in package.json:
   * clean: ['dist', 'coverage']
   * ```
   */
  clean?: UserConfig['clean']
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
   * Whether to generate source map files. The same default as the `sourcemap` option in
   * `@sanity/pkg-utils` - tsdown itself defaults to `false` and does not read `sourceMap` from
   * the tsconfig.
   * @defaultValue true
   */
  sourcemap?: UserConfig['sourcemap']
  /**
   * tsdown's `deps` option. When `platform` is `'neutral'` (the default), `neverBundle` always
   * includes `/^node:/` and userland `neverBundle` entries are appended (tsdown's `mergeConfig`
   * would replace the array). Other `deps` fields pass through as-is.
   */
  deps?: UserConfig['deps']
  /**
   * tsdown's experimental [`css` option](https://tsdown.dev/options/css) (CSS modules,
   * preprocessors, Lightning CSS / PostCSS, inject, etc). Passed through as-is — requires
   * [`@tsdown/css`](https://www.npmjs.com/package/@tsdown/css) to be installed in the project.
   * Safe to combine with {@link PackageOptions.vanillaExtract}: vanilla-extract extracts into
   * `bundle.css` by default, while `@tsdown/css` merges other CSS (including `.module.css`)
   * into `style.css`, so the two pipelines do not collide.
   * @see https://tsdown.dev/reference/api/Interface.InlineConfig#css
   */
  css?: UserConfig['css']
  /**
   * Runs `babel-plugin-react-compiler` on the source files before they are bundled, so published
   * components are memoized automatically. Pass `true` to use the defaults, or an options object
   * to configure the compiler (e.g. `{target: '18'}`).
   * This is the same feature as the `babel: {reactCompiler: true}` and `reactCompilerOptions`
   * options in `@sanity/pkg-utils`. Unlike `styledComponents` there's no oxc native port of the
   * React Compiler yet, so `babel-plugin-react-compiler` needs to be installed.
   *
   * The options object also accepts `reactServer: true` (an option of this config, not the
   * compiler), which additionally emits an uncompiled build of every entry wired to the
   * `react-server` export condition, for libraries that render in React Server Components —
   * see {@link ReactCompilerOptions.reactServer}.
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
   * minified and lowered with `lightningcss`. The lowering targets come from the effective
   * `target` (`vanillaExtract.target`, falling back to the top-level `target`) when it names
   * browsers; when it's undefined or browserless (e.g. `'node20'`), they're resolved from
   * `@sanity/browserslist-config` instead — see {@link PackageVanillaExtractOptions}. Pass
   * `true` to use the defaults, or an object to customize.
   *
   * By default (`inject: {nodeCompat: true}`) the plugin also injects the self-referential
   * `import "<pkg>/bundle.css"`, emits a `bundle-css.js` shim, and writes the conditional
   * `"./bundle.css"` export to `package.json` - see {@link PackageVanillaExtractOptions}.
   * This is the same feature as `rollup.vanillaExtract` in `@sanity/pkg-utils`.
   *
   * Combines with {@link PackageOptions.css}: enable both when a package uses vanilla-extract
   * alongside CSS modules (or other `@tsdown/css` features).
   * @alpha
   */
  vanillaExtract?: boolean | PackageVanillaExtractOptions
}

/**
 * @public
 */
export function defineConfig(
  options: PackageOptions & {reactCompiler: ReactCompilerOptions & {reactServer: true}},
): Promise<UserConfig[]>
/**
 * @public
 */
export function defineConfig(options?: PackageOptions): Promise<UserConfig>
/**
 * @public
 */
export async function defineConfig(
  options: PackageOptions = {},
): Promise<UserConfig | UserConfig[]> {
  const reactCompiler = options.reactCompiler ?? false
  // `reactCompiler.reactServer` opts into the dual React Server Components build: the same
  // config twice, where the only difference is that React Compiler auto-memoization is applied
  // to the non-`react-server` variant. Both variants build in one `tsdown` run — tsdown builds
  // the configs in parallel, cleans the shared `outDir` once before either variant emits, and
  // runs `exports` generation and `publint` per `package.json` only after every build for that
  // package has finished (so the `react-server` files exist by the time they're validated).
  if (typeof reactCompiler === 'object' && reactCompiler.reactServer === true) {
    return Promise.all([
      resolvePackageConfig(options, 'default'),
      resolvePackageConfig(options, 'react-server'),
    ])
  }
  return resolvePackageConfig(options, 'standalone')
}

/**
 * The build variants {@link defineConfig} produces: the classic single build
 * (`'standalone'`), or — with `reactCompiler.reactServer` — the compiled `'default'` variant
 * and the uncompiled `'react-server'` variant of the dual React Server Components build.
 */
type PackageConfigVariant = 'standalone' | 'default' | 'react-server'

async function resolvePackageConfig(
  options: PackageOptions,
  variant: PackageConfigVariant,
): Promise<UserConfig> {
  // `tsconfig`, `entry`, `dts`, `define`, `target`, `outDir`, `clean` and `css` are passed
  // through to tsdown as-is. When left undefined, tsdown keeps its default behavior
  // (`tsconfig` is auto-detected from the project, `dts` from `package.json`, `define`
  // replaces nothing, `target` applies no syntax downleveling, `outDir` defaults to `'dist'`,
  // `clean` defaults to `true` — cleaning `outDir` before each build — and `css` stays off
  // unless `@tsdown/css` is installed and the option is set).
  const {entry, tsconfig, define, target, outDir, css} = options
  const isReactServer = variant === 'react-server'
  // The `react-server` variant skips d.ts generation (the compiled variant's declarations
  // serve both entries — TypeScript resolves types through the `default` condition), never
  // cleans (tsdown collects the clean paths of all configs and cleans once, before either
  // variant emits, so the compiled variant's `clean` already covers the run), and skips
  // `publint` (it runs once, from the compiled variant, after both builds finish).
  const dts = isReactServer ? false : options.dts
  const clean = isReactServer ? false : options.clean
  const publint = !isReactServer
  const platform = options.platform ?? 'neutral'
  const sourcemap = options.sourcemap ?? true
  // The React Compiler is what the `react-server` variant exists to avoid: compiled output
  // loads `react/compiler-runtime`, which throws in the `react-server` environment.
  const reactCompiler = isReactServer ? false : (options.reactCompiler ?? false)
  const styledComponents = options.styledComponents ?? false
  const report = {gzip: false} as const satisfies UserConfig['report']
  const format = options.format ?? 'esm'
  // When `platform` is `'neutral'`, restore the conventional `module`/`main` fallback that
  // rolldown's strict neutral defaults drop - needed for inlined deps without an `exports` map.
  const inputOptions = {
    // https://github.com/rolldown/rolldown/blob/main/packages/rolldown/src/options/docs/preserve-entry-signatures.md#strict
    preserveEntrySignatures: 'strict',
    experimental: {attachDebugInfo: 'none'},
    ...(platform === 'neutral' && {
      resolve: {mainFields: ['module', 'main']},
    }),
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
  } satisfies UserConfig['inputOptions']

  // `neverBundle` is concatenated (not `mergeConfig`'d) so per-package externals add to the
  // `/^node:/` default for `platform: 'neutral'` instead of replacing it. Rolldown's
  // `ExternalOption` array form is `Array<string | RegExp>` only; a function override is composed.
  const userNeverBundle = options.deps?.neverBundle
  const nodeBuiltinExternal = platform === 'neutral' ? /^node:/ : undefined
  const neverBundle: NonNullable<UserConfig['deps']>['neverBundle'] =
    userNeverBundle == null
      ? nodeBuiltinExternal && [nodeBuiltinExternal]
      : nodeBuiltinExternal == null
        ? userNeverBundle
        : typeof userNeverBundle === 'function'
          ? (id, importer, isResolved) =>
              nodeBuiltinExternal.test(id) || userNeverBundle(id, importer, isResolved)
          : [
              nodeBuiltinExternal,
              ...(Array.isArray(userNeverBundle) ? userNeverBundle : [userNeverBundle]),
            ]
  const deps: UserConfig['deps'] =
    options.deps === undefined && neverBundle === undefined
      ? undefined
      : {
          ...options.deps,
          ...(neverBundle === undefined ? {} : {neverBundle}),
        }

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
    // `reactServer` belongs to this config, not the compiler — drop it before handing the
    // options over to the babel preset.
    const {reactServer: _reactServer, ...reactCompilerOptions} =
      typeof reactCompiler === 'object' ? reactCompiler : {}
    plugins.push(
      await pluginBabel({
        presets: [reactCompilerPreset(reactCompilerOptions)],
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
        minify: true,
        ...vanillaExtract,
        lightningcss,
      }),
    )
  }

  // The `react-server` variant does not participate in `exports` generation: its files are
  // wired in through the compiled variant's `react-server` conditions instead of becoming
  // export subpaths of their own.
  let exports: UserConfig['exports'] = false
  if (!isReactServer) {
    const packageManager = await detect({cwd: process.cwd()})
    // tsdown's `exports` feature is enabled with Sanity-flavored defaults, and userland values
    // apply with tsdown's own `mergeConfig` semantics: an object deep-merges over the defaults,
    // anything else (`false`, a CI condition) replaces them.
    ;({exports} = mergeConfig(
      {
        exports: {
          enabled: 'local-only',
          // Only opt in by default when pnpm is detected: support for replacing package fields
          // from `publishConfig` is not reliable across package managers.
          ...(packageManager?.name === 'pnpm' && {devExports: true}),
        },
      },
      {exports: options.exports},
    ))
    if (variant === 'default' && exports) {
      // The compiled variant owns `exports` generation for the dual build, so the
      // `react-server` conditions are composed into its `customExports`: every entry export
      // gains a `react-server` condition pointing at the `.server.` sibling that the
      // `react-server` variant emits.
      exports = withReactServerExports(exports)
    }
  }

  return defineTsdownConfig({
    // Rolldown defaults `circularDependency` to `false`; enable it so Sanity library builds
    // surface import cycles (bigger bundles / execution-order hazards) as warnings.
    // Override via `mergeConfig(..., {checks: {circularDependency: false}})`.
    // https://rolldown.rs/reference/InputOptions.checks#circulardependency
    checks: {circularDependency: true},
    clean,
    css,
    define,
    deps,
    dts,
    entry,
    exports,
    format,
    inputOptions,
    outDir,
    // The `react-server` variant writes its files next to the compiled ones, with `.server`
    // inserted before tsdown's default extension (`index.js` ↔ `index.server.js`). Hashed
    // chunk filenames get the suffix too, so the two variants' chunks never collide in the
    // shared `outDir`.
    outExtensions: isReactServer ? reactServerOutExtensions : undefined,
    platform,
    plugins,
    publint,
    report,
    sourcemap,
    target,
    tsconfig,
    minify: {compress: true, codegen: false, mangle: false},
  })
}

/**
 * The `outExtensions` of the `react-server` variant: tsdown's default extension for the
 * format and package type (see `resolveJsOutputExtension` in tsdown), with `.server` inserted
 * so the variant's entries sit next to the compiled ones (`index.js` ↔ `index.server.js`,
 * `index.cjs` ↔ `index.server.cjs`, and `.mjs` accordingly for CommonJS packages).
 */
const reactServerOutExtensions: NonNullable<UserConfig['outExtensions']> = ({
  format,
  pkgType,
}) => ({
  js:
    format === 'cjs'
      ? pkgType === 'module'
        ? '.server.cjs'
        : '.server.js'
      : pkgType === 'module'
        ? '.server.js'
        : '.server.mjs',
})

type ExportsOptions = Extract<NonNullable<UserConfig['exports']>, object>
type CustomExportsFunction = Extract<
  NonNullable<ExportsOptions['customExports']>,
  (...args: never[]) => unknown
>
type ExportsMap = Parameters<CustomExportsFunction>[0]
type ChunksByFormat = Parameters<CustomExportsFunction>[1]['chunks']

/**
 * Wires the `react-server` conditions into tsdown's `exports` feature by composing into
 * `exports.customExports` (the same composition `@sanity/vanilla-extract-tsdown-plugin` uses
 * for its conditional CSS export): a pre-existing `customExports` applies first — both its
 * function and record forms, mirroring how tsdown itself applies them — and the
 * `react-server` conditions are inserted into the result. The composed function runs for both
 * the local `exports` map and `publishConfig.exports`; with `devExports` the local map points
 * at source files, which the entry-file matching leaves untouched (source resolves for every
 * condition in development, which is correct — uncompiled source is exactly what the
 * `react-server` condition ships).
 */
function withReactServerExports(
  exportsOption: Exclude<NonNullable<UserConfig['exports']>, false>,
): ExportsOptions {
  // Normalize the `boolean | CIOption | object` forms of the `exports` option into the
  // object form, preserving the enabled-ness (`true` and bare CI conditions mean enabled)
  const exportsOptions: ExportsOptions =
    exportsOption === true
      ? {}
      : typeof exportsOption === 'string'
        ? {enabled: exportsOption}
        : exportsOption
  const previousCustomExports = exportsOptions.customExports
  exportsOptions.customExports = async (exportsMap, context) => {
    // Apply a pre-existing `customExports` first (both its function and record forms,
    // mirroring how tsdown itself applies them), then insert the `react-server` conditions
    const base =
      typeof previousCustomExports === 'function'
        ? await previousCustomExports(exportsMap, context)
        : previousCustomExports
          ? {...exportsMap, ...previousCustomExports}
          : exportsMap
    return addReactServerConditions(base, context.chunks)
  }
  return exportsOptions
}

/** Matches the JS output extensions tsdown emits for `es`/`cjs` chunks. */
const RE_JS_FILE = /\.(m?js|cjs)$/

/** The conditions tsdown generates that resolve at runtime, in contrast to `types` etc. */
const RUNTIME_CONDITIONS = new Set(['import', 'require', 'default'])

/**
 * Inserts a `react-server` condition into every entry export of an `exports`-shaped map,
 * pointing at the `.server.` sibling emitted by the `react-server` variant — e.g.
 * `"./dist/index.js"` becomes
 * `{"react-server": "./dist/index.server.js", "default": "./dist/index.js"}`.
 *
 * Entries are recognized by matching path leaves against the compiled variant's entry chunk
 * filenames, so non-entry exports (`./package.json`, the conditional `./bundle.css` export of
 * `vanillaExtract`, `devExports` source paths like `./src/index.ts`) pass through untouched.
 * The `react-server` files themselves never enter the map — the `react-server` variant builds
 * with `exports: false` — so they don't become export subpaths of their own.
 */
function addReactServerConditions(exportsMap: ExportsMap, chunks: ChunksByFormat): ExportsMap {
  // Entry JS chunk filenames of the compiled variant; the `react-server` variant's files sit
  // next to them with `.server` inserted before the extension
  const entryFileNames: string[] = []
  for (const [format, formatChunks] of Object.entries(chunks)) {
    // Only `es` and `cjs` chunks become package exports (mirroring tsdown's own generation)
    if (format !== 'es' && format !== 'cjs') continue
    for (const chunk of formatChunks) {
      if (chunk.type === 'chunk' && chunk.isEntry && RE_JS_FILE.test(chunk.fileName)) {
        entryFileNames.push(chunk.fileName)
      }
    }
  }
  const isEntryFile = (value: unknown): value is string =>
    typeof value === 'string' && entryFileNames.some((fileName) => value.endsWith(`/${fileName}`))

  const result: ExportsMap = {}
  for (const [key, value] of Object.entries(exportsMap as Record<string, unknown>)) {
    result[key] = withReactServerCondition(value, isEntryFile)
  }
  return result
}

function withReactServerCondition(
  value: unknown,
  isEntryFile: (value: unknown) => value is string,
): unknown {
  // A bare-string entry export (e.g. the pure-ESM publish shape `".": "./dist/index.js"`)
  // becomes a conditional export with `react-server` resolving first
  if (isEntryFile(value)) {
    return {'react-server': toServerFile(value), 'default': value}
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const conditions = Object.entries(value)
  const matched = conditions.filter(
    (entry): entry is [string, string] =>
      RUNTIME_CONDITIONS.has(entry[0]) && isEntryFile(entry[1]),
  )
  const [firstMatch] = matched
  if (!firstMatch) return value
  // A single runtime file maps to a plain path; a dual-format entry nests its `import` and
  // `require` files under the `react-server` condition
  const serverTarget =
    matched.length === 1
      ? toServerFile(firstMatch[1])
      : Object.fromEntries(
          matched.map(([condition, target]) => [condition, toServerFile(target)]),
        )
  // Conditions match in order, so `react-server` is inserted right before the first runtime
  // condition (`import`/`require`/`default`), keeping `types` and custom development
  // conditions (`devExports`) ahead of it
  const next: Record<string, unknown> = {}
  let inserted = false
  for (const [condition, target] of conditions) {
    if (!inserted && RUNTIME_CONDITIONS.has(condition)) {
      next['react-server'] = serverTarget
      inserted = true
    }
    next[condition] = target
  }
  if (!inserted) {
    next['react-server'] = serverTarget
  }
  return next
}

/** `./dist/index.js` → `./dist/index.server.js` (and `.mjs`/`.cjs` accordingly). */
function toServerFile(file: string): string {
  return file.replace(RE_JS_FILE, '.server.$1')
}
