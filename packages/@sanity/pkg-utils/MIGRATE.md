# Migrating `@sanity/pkg-utils`

## v14: vanilla-extract support removed

v14 no longer compiles vanilla-extract `.css.ts` files. The `vanillaExtract` option is gone, and a
`package.config.ts` that still sets it fails the build with a link to this section. The
`vanillaExtract` option of
[`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme)
was removed in 0.32.0, and the `@sanity/vanilla-extract-*` packages are deprecated and no longer
maintained.

Remove `vanillaExtract` from `package.config.ts`, then pick one of these:

- **Keep vanilla-extract** and use its own tooling. Add one of the
  [vanilla-extract bundler integrations](https://vanilla-extract.style/documentation/integrations/vite/)
  to `plugins`. `@vanilla-extract/rollup-plugin` runs under tsdown:

  ```ts
  import {defineConfig} from '@sanity/pkg-utils'
  import {vanillaExtractPlugin} from '@vanilla-extract/rollup-plugin'

  export default defineConfig({
    plugins: [vanillaExtractPlugin()],
  })
  ```

  The plugin decides how the CSS is emitted and imported (see its `extract` option). pkg-utils no
  longer injects `import "<pkg>/bundle.css"`, emits the `bundle-css.js` shim, or writes the
  `./bundle.css` export for it, so remove that export from `package.json` unless you still
  provide the file yourself.

- **Move the styles to plain CSS or CSS modules** with the [`css` option](./README.md#css). It
  keeps the conditional CSS export pattern. `css: {fileName: 'bundle.css'}` keeps the
  `./bundle.css` subpath consumers already import.

Apps that used `@sanity/vanilla-extract-vite-plugin` can switch to the official
[`@vanilla-extract/vite-plugin`](https://vanilla-extract.style/documentation/integrations/vite/).

## v12: tsdown

v12 replaced the rollup/rolldown build stack with [`tsdown`](https://tsdown.dev) +
[`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme).

Most packages need **no changes**. If your `package.config.ts` uses a removed option, the build
stops with an error that contains these same migration instructions (skipped when
`NODE_ENV=production`, or with `legacyChecks: false`).

## TL;DR

| v11                                 | v12                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `dts: 'rolldown'`                   | delete it (it's the default now)                                             |
| `dts: 'api-extractor'`              | delete it (types come from tsdown)                                           |
| `tsgo: true`                        | `dts: {generator: 'tsgo'}`                                                   |
| `babel: {reactCompiler: true}`      | `reactCompiler: true`                                                        |
| `reactCompilerOptions: {...}`       | `reactCompiler: {...}`                                                       |
| `babel: {styledComponents: true}`   | `styledComponents: true`                                                     |
| `babel: {plugins: [...]}`           | `plugins` + [`@rolldown/plugin-babel`](#custom-babel-plugins)                |
| `rollup: {vanillaExtract: true}`    | removed in v14, see [above](#v14-vanilla-extract-support-removed)            |
| `css: {inject: {nodeCompat: true}}` | `css: {inject: true, exports: {nodeCompat: true}}` (deprecated, still works) |
| `rollup: {plugins: [...]}`          | `plugins: [...]`                                                             |
| `rollup: {optimizeLodash: ...}`     | removed — see [lodash](#lodash)                                              |
| `extract: {enabled: false}`         | `tsdoc: false`                                                               |
| `extract: {rules, customTags}`      | `tsdoc: {rules, customTags}`                                                 |
| `extract: {bundledPackages: [...]}` | `deps: {alwaysBundle: [...]}` — see [type inlining](#type-inlining)          |
| `external: [...]`                   | `deps: {neverBundle: [...]}` (deprecated, still works)                       |
| `external: (prev) => prev.filter()` | `deps: {alwaysBundle: [...]}` (deprecated, still works)                      |
| `jsx`, `jsxFactory`, …              | `tsconfig.json` `compilerOptions.jsx` and friends                            |
| `process.env.PKG_FORMAT`            | [`package.json#imports` conditions](#pkg_format-and-pkg_runtime)             |
| `process.env.PKG_RUNTIME`           | [`package.json#imports` conditions](#pkg_format-and-pkg_runtime)             |
| `process.env.PKG_FILE_PATH`         | [`import.meta.url`](#pkg_file_path)                                          |
| `pkg build --clean`                 | delete it (cleaning is on by default; `--no-clean` skips it)                 |

Other behavior changes:

- **Node 20 is no longer supported for running builds**: `engines.node` is
  `^22.18.0 || >=24.11.0` (tsdown's requirement). The published output is unaffected.
- **Shared chunks are content-hashed** (`_chunks-[format]` folders are gone), so a chunk can
  never take an entry's filename ([sanity-io/ui#2262](https://github.com/sanity-io/ui/issues/2262)).
- **`pkg check` runs [publint](https://publint.dev)** on the packed package (with
  `publishConfig` applied) instead of the esbuild resolution checks. Fix what it reports — it
  lints what consumers actually install.
- **Builds keep `exports` in sync**: the map is regenerated from the build (with the
  `source`-condition development pattern and a `source`-less `publishConfig.exports`), including
  in CI — so environments that set `CI=true` without meaning "skip package.json" still behave.
- `tsdown.config.*` files are **never** loaded by `pkg build` — `package.config.ts` is the only
  config source. For customization beyond the config surface, use `tsdown` +
  `@sanity/tsdown-config` directly.

## `PKG_FORMAT` and `PKG_RUNTIME`

The `process.env.PKG_FORMAT` and `process.env.PKG_RUNTIME` build-time constants are gone
(`process.env.PKG_VERSION` remains). Use
[conditional `package.json#imports`](https://nodejs.org/api/packages.html#imports) instead —
they express the same thing with more precision, and conditions compose (`require` vs `import`,
`node`/`browser`/`worker`, `deno`/`bun`, `react-server`, …).

### Per-platform code, resolved at build time (replaces `PKG_RUNTIME`)

Give each platform its own file; every build of the waterfall inlines the matching condition
(the `browser`/`node` variant builds pick their files, everything else gets `default`):

```json
{
  "imports": {
    "#env": {
      "browser": "./src/env.browser.ts",
      "node": "./src/env.node.ts",
      "default": "./src/env.default.ts"
    }
  }
}
```

```ts
// src/index.ts
export {env} from '#env'
```

### Per-format (or per-runtime) code, resolved at load time (replaces `PKG_FORMAT`)

Bundled code can't branch per output format at build time — one module graph feeds both
formats. Point the import map at two small **shipped** files and keep the specifier external,
so Node (and consumers' bundlers) resolve it when the package loads:

```json
{
  "imports": {
    "#format": {
      "require": "./format.cjs",
      "default": "./format.mjs"
    }
  },
  "files": ["dist", "format.cjs", "format.mjs"]
}
```

```ts
// package.config.ts — keep `#…` specifiers external
export default defineConfig({
  deps: {neverBundle: [/^#/]},
})
```

## `PKG_FILE_PATH`

Use `import.meta.url` — it works in both output formats (the CJS output rewrites it to
`require("url").pathToFileURL(__filename).href`):

```ts
import {fileURLToPath} from 'node:url'

const filePath = fileURLToPath(import.meta.url)
```

## Custom Babel plugins

Install [`@rolldown/plugin-babel`](https://www.npmjs.com/package/@rolldown/plugin-babel) in
your package and pass it through `plugins`:

```ts
import pluginBabel from '@rolldown/plugin-babel'
import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  plugins: [await pluginBabel({plugins: ['babel-plugin-example']})],
})
```

(`styledComponents` no longer needs Babel at all — it uses oxc's native port, so
`babel-plugin-styled-components` can be uninstalled.)

## Type inlining

Type inlining follows the bundling decisions now:

- imported `devDependencies` are inlined automatically (JS **and** types),
- `deps: {alwaysBundle: [...]}` force-inlines a `dependency`/`peerDependency` (JS **and** types).

Inlining only the _types_ of an external dependency (the v11 `extract.bundledPackages` pattern)
has no successor.

Note tsdown's matching semantics: strings match exactly (or as globs), so covering subpath
imports takes a pattern like `/^@scope\/name(\/|$)/`.

## lodash

The lodash import optimization is gone, including the implicit auto-enable when `lodash` was a
dependency. Preferably drop lodash altogether (see [e18e.dev](https://e18e.dev) for
replacements like [`es-toolkit`](https://es-toolkit.dev)), or import from `lodash-es`, which
tree-shakes in consumers without build-time rewriting.
