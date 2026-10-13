# @sanity/vanilla-extract-rolldown-plugin

A [rolldown](https://rolldown.rs) plugin for [vanilla-extract](https://vanilla-extract.style),
built for bundling libraries that ship pre-extracted CSS. Unlike
[`@vanilla-extract/rollup-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin)
it doesn't declare `rollup` as a peer dependency, so it doesn't pull a second bundler into
rolldown projects. It also declares
[plugin hook filters](https://rolldown.rs/apis/plugin-api#plugin-hook-filters), so rolldown skips
the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related
([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)).
Head-to-head numbers against the official Rollup pipeline (across minify/target variants) live in
the [vanilla-extract benchmarks](https://github.com/sanity-io/pkg-utils/tree/main/benchmarks/vanilla-extract#latest-results).

The plugin compiles all `.css.ts` modules and extracts their CSS into a single file (`bundle.css`
by default), optionally lowered and minified with [lightningcss](https://lightningcss.dev),
following the same architecture (and option vocabulary and defaults) as
[`@tsdown/css`](https://tsdown.dev/options/css).

Two independent options control what happens to the extracted CSS, both disabled by default like
`css.inject` in `@tsdown/css`:

- **`inject`** prepends an import of the CSS to every entry chunk that uses vanilla-extract styles,
  through rolldown's native magic-string, so sourcemaps stay intact.
- **`exports`** publishes the CSS as the `"./bundle.css"` export subpath of the package. Any
  injected import then uses the self-referential `"<pkg>/bundle.css"` bare specifier instead of a
  relative path.

`exports: true` declares a plain `"./bundle.css": "./dist/bundle.css"` export, which is enough for
packages that only ever run in browsers or bundlers. `exports: {nodeCompat: true}` declares a
conditional export instead, and emits a no-op `bundle-css.js` shim (plus `bundle-css.d.ts` for the
export's `types` condition) for its `node`/`default` conditions to point at, so the subpath stays
resolvable in runtimes that cannot import `.css` files. The shim is named with a hyphen
(`bundle-css.js`) rather than a `.css.js` suffix so it does not match vanilla-extract's
`cssFileFilter`.

Writing the export to `package.json` is the host tool's job — with tsdown,
[`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme)
maintains it automatically.

> [!NOTE]
> `inject: {nodeCompat: true}` is deprecated. It means `{inject: true, exports: {nodeCompat: true}}`
> and still works, with a warning: `nodeCompat` configures how the CSS file is published, not how
> the import is injected, so it moved to `exports`.

## Usage

```sh
pnpm add --save-dev @sanity/vanilla-extract-rolldown-plugin @vanilla-extract/css
```

```ts
// rolldown.config.ts
import {vanillaExtractPlugin} from '@sanity/vanilla-extract-rolldown-plugin'
import {defineConfig} from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  plugins: [vanillaExtractPlugin()],
})
```

If you're bundling with [tsdown](https://tsdown.dev), prefer
[`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme):
it wraps this plugin with tsdown's config hooks, defaulting the CSS syntax lowering `target` to
tsdown's top-level `target` and writing the conditional `"./bundle.css"` export to `package.json`
through tsdown's [`exports` feature](https://tsdown.dev/options/package-exports). With
[`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#vanilla-extract),
its `vanillaExtract` option wires all of that up with the defaults most Sanity libraries want.

The extract model is for library builds: from Vite it only makes sense in build-only library
setups (`build.rolldownOptions.plugins`), not as an application plugin — Vite's dev server never
runs the output-phase hooks the extraction relies on. For Vite 8 apps, use
[`@sanity/vanilla-extract-vite-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-vite-plugin#readme),
which feeds the CSS through Vite's own pipeline (with HMR and SSR support) instead.

## Options

The options are modeled after the [`css` options of `@tsdown/css`](https://tsdown.dev/options/css),
so they feel familiar in a rolldown-based toolchain:

```ts
vanillaExtractPlugin({
  /**
   * Formatting of identifiers (class names, keyframes, CSS vars, etc): 'short' (a hash of the
   * package name and file path, then a per-file counter), 'safe' ('short' with the package
   * version also hashed in, see below), 'debug' ('short' prefixed with file and debug names),
   * or a custom function.
   * @defaultValue 'short'
   */
  identifiers: 'short',
  /**
   * Name of the emitted CSS file, like `css.fileName` (which defaults to 'style.css').
   * @defaultValue 'bundle.css'
   */
  fileName: 'bundle.css',
  /**
   * Minify the extracted CSS with lightningcss, matching `css.minify`.
   * @defaultValue false
   */
  minify: false,
  /**
   * CSS syntax lowering target, in esbuild-style strings like `css.target`. Matching
   * `@tsdown/css`, lowering is skipped when no target is configured, or when the targets
   * don't include any browsers (e.g. `'node20'`, which speaks to the JS runtime, not the
   * browsers the CSS runs in). Set to `false` to disable lowering explicitly.
   * (`@sanity/tsdown-config` layers a `@sanity/browserslist-config` default on top for
   * browserless targets, through `lightningcss.targets`.)
   */
  target: 'chrome90',
  /**
   * Options passed through to lightningcss's `transform()`, like `css.lightningcss`.
   * `lightningcss.targets` takes precedence over the esbuild-style `target`, while the
   * plugin-managed fields (`minify`, `cssModules`) win over their lightningcss counterparts.
   */
  lightningcss: {errorRecovery: true},
  /**
   * Inject an import of the extracted CSS into the JS output, like `css.inject` (and matching
   * its default of `false`). The specifier is relative unless `exports` publishes the CSS,
   * in which case it is the self-referential `import "<pkg>/<fileName>"`.
   * @defaultValue false
   */
  inject: true,
  /**
   * Publish the CSS as the `"./<fileName>"` export subpath. `true` declares a plain string
   * export; `{nodeCompat: true}` declares a conditional export and emits the no-op JS shim
   * plus its `.d.ts`, so the subpath also resolves in runtimes that cannot load `.css`.
   * @defaultValue false
   */
  exports: {nodeCompat: true},
})
```

### Release-safe identifiers

The default `'short'` identifiers are vanilla-extract's: `@emotion/hash(packageName + filePath)`
followed by a base-36 counter of the identifiers generated in the file so far (and a `_` prefix
when the name starts with a digit). Nothing in that changes between releases, so a release that
reorders a file's styles reuses its class names for different rules — `._2mi48t0` is the Button
loading overlay in `@sanity/ui` 4.4.2 and the Button root in 4.4.4. Pages that load the CSS of
both releases style one release's markup with the other's rules.

`identifiers: 'safe'` is `'short'` with the package version in the hash:
`@emotion/hash(packageName + '@' + packageVersion + filePath)`, with the same counter and `_`
prefix. The version comes from the same `package.json` the package name is read from (the
nearest one with a `name`, from the build's working directory). Every release gets its own class
names, the same release always builds the same ones, and the names stay as short as `'short'`
ones. It is opt-in because it renames every class on every release.

```ts
vanillaExtractPlugin({identifiers: 'safe'})
```

CSS sourcemaps are not emitted, matching `@tsdown/css` — which
[intentionally skips them](https://github.com/rolldown/tsdown/issues/472#issuecomment-4017224099)
on the grounds that Vite's build mode doesn't support CSS sourcemaps either
([vitejs/vite#2830](https://github.com/vitejs/vite/issues/2830)).

## Adapter API

Host-specific adapters can provide resolved defaults through the plugin's
[`api`](https://rolldown.rs/apis/plugin-api) property — this is how
`@sanity/vanilla-extract-tsdown-plugin` forwards tsdown's resolved config:

```ts
const plugin = vanillaExtractPlugin(options)
plugin.api.setBuildContext({
  // Default for the `target` option (e.g. the host's resolved top-level target)
  target: ['chrome90'],
  // Package name for the self-referential import of `exports`
  packageName: 'my-library',
  // Working directory the `.css.ts` modules are compiled from
  cwd: process.cwd(),
})
```

## Acknowledgements

The plugin combines a port of
[`@vanilla-extract/rollup-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin)
(MIT licensed, Copyright (c) 2021 SEEK) with the CSS collection and emission architecture of
[`@tsdown/css`](https://github.com/rolldown/tsdown/tree/main/packages/css) (MIT licensed,
Copyright (c) 2025-present VoidZero Inc. & Contributors, Copyright (c) 2024 Kevin Deng). The full
combined license notices are in this package's [LICENSE](./LICENSE) file.
