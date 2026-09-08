# @sanity/vanilla-extract-tsdown-plugin

A [tsdown](https://tsdown.dev) plugin for [vanilla-extract](https://vanilla-extract.style), built
for bundling libraries that ship pre-extracted CSS. It wraps the rolldown-generic
[`@sanity/vanilla-extract-rolldown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-rolldown-plugin#readme) —
which compiles all `.css.ts` modules and extracts their CSS into a single file (`bundle.css` by
default), optionally lowered and minified with [lightningcss](https://lightningcss.dev),
following the same architecture (and option vocabulary and defaults) as
[`@tsdown/css`](https://tsdown.dev/options/css) — and adds the tsdown specifics on top:

- the CSS syntax lowering `target` defaults to tsdown's resolved top-level
  [`target`](https://tsdown.dev/options/output#target) (and, matching `css.target`, lowering is
  skipped when the targets name no browsers — e.g. a `node20` target resolved from
  `engines.node`),
- the self-referential import of `exports` uses the package name tsdown resolved, and
- the `"./bundle.css"` export is written to `package.json` through the plugin's `tsdownConfig`
  hook when tsdown's [`exports` feature](https://tsdown.dev/options/package-exports) is enabled —
  conditional with `nodeCompat` (`types` → the shim's `.d.ts`, `browser`/`style` → the real CSS,
  `node`/`default` → the no-op shim), a plain string otherwise.

Unlike `@vanilla-extract/rollup-plugin` it doesn't declare `rollup` as a peer dependency, so it
doesn't pull a second bundler into tsdown projects. It also declares
[plugin hook filters](https://rolldown.rs/apis/plugin-api#plugin-hook-filters), so rolldown skips
the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related
([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)).
Head-to-head numbers for the underlying rolldown plugin against the official Rollup pipeline live
in the [vanilla-extract benchmarks](https://github.com/sanity-io/pkg-utils/tree/main/benchmarks/vanilla-extract#latest-results).

Two independent options control what happens to the extracted CSS, both disabled by default like
`css.inject` in `@tsdown/css`:

- **`inject`** prepends an import of the CSS to every entry chunk that uses vanilla-extract styles,
  through rolldown's native magic-string, so sourcemaps stay intact.
- **`exports`** publishes the CSS as the `"./bundle.css"` export subpath, writing it to
  `package.json` (and `publishConfig.exports`) when tsdown's `exports` feature is enabled. Any
  injected import then uses the self-referential `"<pkg>/bundle.css"` bare specifier.

`exports: {nodeCompat: true}` is the flavor most libraries want: the export becomes conditional and
a no-op `bundle-css.js` shim (plus `bundle-css.d.ts` for its `types` condition) is emitted, so the
subpath stays resolvable in runtimes that cannot import `.css` files. `exports: true` declares a
plain string export without the shim, for packages that only ever run in browsers or bundlers.

> [!NOTE]
> `inject: {nodeCompat: true}` is deprecated. It means `{inject: true, exports: {nodeCompat: true}}`
> and still works, with a warning: `nodeCompat` configures how the CSS file is published, not how
> the import is injected, so it moved to `exports`.

## Usage

```sh
pnpm add --save-dev @sanity/vanilla-extract-tsdown-plugin @vanilla-extract/css
```

```ts
// tsdown.config.ts
import {vanillaExtractPlugin} from '@sanity/vanilla-extract-tsdown-plugin'
import {defineConfig} from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  plugins: [vanillaExtractPlugin()],
})
```

If you're using [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#vanilla-extract),
prefer its `vanillaExtract` option instead: it uses this plugin under the hood with the defaults
most Sanity libraries want - `inject: true` with `exports: {nodeCompat: true}`, and tsdown's
`exports` feature already enabled so the conditional `"./bundle.css"` export is maintained
automatically.

If you're bundling with raw [rolldown](https://rolldown.rs) (or a Vite build-only library setup)
instead of tsdown, use
[`@sanity/vanilla-extract-rolldown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-rolldown-plugin#readme)
directly - it provides everything except the tsdown config wiring described above.

## Options

The options are the [`@sanity/vanilla-extract-rolldown-plugin` options](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-rolldown-plugin#options),
modeled after the [`css` options of `@tsdown/css`](https://tsdown.dev/options/css), so they feel
familiar in a tsdown config:

```ts
vanillaExtractPlugin({
  /**
   * Formatting of identifiers (class names, keyframes, CSS vars, etc).
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
   * CSS syntax lowering target, in esbuild-style strings like `css.target`. Defaults to
   * tsdown's resolved top-level `target`. Matching `@tsdown/css`, lowering is skipped when no
   * target is configured anywhere, or when the targets don't include any browsers (e.g.
   * `'node20'`, which speaks to the JS runtime, not the browsers the CSS runs in). Set to
   * `false` to disable lowering explicitly. (`@sanity/tsdown-config` layers a
   * `@sanity/browserslist-config` default on top for browserless targets.)
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
   * Publish the CSS as the `"./<fileName>"` export subpath, written to `package.json` when
   * tsdown's `exports` feature is enabled. `true` declares a plain string export;
   * `{nodeCompat: true}` declares a conditional export and emits the no-op JS shim plus its
   * `.d.ts`, so the subpath also resolves in runtimes that cannot load `.css`.
   * @defaultValue false
   */
  exports: {nodeCompat: true},
})
```

CSS sourcemaps are not emitted, matching `@tsdown/css` — which
[intentionally skips them](https://github.com/rolldown/tsdown/issues/472#issuecomment-4017224099)
on the grounds that Vite's build mode doesn't support CSS sourcemaps either
([vitejs/vite#2830](https://github.com/vitejs/vite/issues/2830)).
