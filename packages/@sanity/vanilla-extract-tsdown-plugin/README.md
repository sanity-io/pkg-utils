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
- the self-referential import injected by `inject: {nodeCompat: true}` uses the package name
  tsdown resolved, and
- the conditional `"./bundle.css"` export (`types` → the shim's `.d.ts`, `browser`/`style` → the
  real CSS, `node`/`default` → the no-op shim) is written to `package.json` through the plugin's
  `tsdownConfig` hook when tsdown's [`exports` feature](https://tsdown.dev/options/package-exports)
  is enabled.

Unlike `@vanilla-extract/rollup-plugin` it doesn't declare `rollup` as a peer dependency, so it
doesn't pull a second bundler into tsdown projects. It also declares
[plugin hook filters](https://rolldown.rs/apis/plugin-api#plugin-hook-filters), so rolldown skips
the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related
([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)).
Head-to-head numbers for the underlying rolldown plugin against the official Rollup pipeline live
in the [vanilla-extract benchmarks](https://github.com/sanity-io/pkg-utils/tree/main/benchmarks/vanilla-extract#latest-results).

Like `css.inject` in `@tsdown/css`, the `inject` option is disabled by default; `inject: true`
injects a relative `import "./bundle.css"` into the entry chunks that use vanilla-extract styles —
through rolldown's native magic-string, so sourcemaps stay intact. `inject: {nodeCompat: true}`
additionally wires up the whole conditional CSS export pattern: the injected import becomes the
self-referential `import "<pkg>/bundle.css"`, a no-op `bundle-css.js` shim (plus
`bundle.css.d.ts` / `bundle-css.d.ts`) is emitted for the `node`/`default` conditions of the
export to point at, so the import is harmless in runtimes that cannot import `.css` files, and
when tsdown's
[`exports` feature](https://tsdown.dev/options/package-exports) is enabled, the conditional
`"./bundle.css"` export is written to `package.json` (`types` → the shim's `.d.ts`,
`browser`/`style` → the real CSS, `node`/`default` → the shim) through the plugin's
`tsdownConfig` hook.

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
most Sanity libraries want - `inject: {nodeCompat: true}`, and tsdown's `exports` feature already
enabled so the conditional `"./bundle.css"` export is maintained automatically.

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
   * its default of `false`). `true` injects a relative `import "./<fileName>"`;
   * `{nodeCompat: true}` instead injects the self-referential `import "<pkg>/<fileName>"` of
   * the conditional CSS export pattern, plus the no-op JS shim, plus the conditional
   * `"./<fileName>"` export in `package.json` (when tsdown's `exports` feature is enabled).
   * @defaultValue false
   */
  inject: {nodeCompat: true},
})
```

CSS sourcemaps are not emitted, matching `@tsdown/css` — which
[intentionally skips them](https://github.com/rolldown/tsdown/issues/472#issuecomment-4017224099)
on the grounds that Vite's build mode doesn't support CSS sourcemaps either
([vitejs/vite#2830](https://github.com/vitejs/vite/issues/2830)).
