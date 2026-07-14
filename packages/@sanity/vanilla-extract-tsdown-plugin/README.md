# @sanity/vanilla-extract-tsdown-plugin

A [tsdown](https://tsdown.dev) plugin for [vanilla-extract](https://vanilla-extract.style), built
for bundling libraries that ship pre-extracted CSS. Unlike
[`@vanilla-extract/rollup-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin)
it doesn't declare `rollup` as a peer dependency, so it doesn't pull a second bundler into tsdown
projects. It also declares
[plugin hook filters](https://rolldown.rs/apis/plugin-api#plugin-hook-filters), so rolldown skips
the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related
([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)).

The plugin compiles all `.css.ts` modules and extracts their CSS into a single file (`bundle.css`
by default), optimized and minified with [lightningcss](https://lightningcss.dev), following the
same architecture (and option vocabulary) as [`@tsdown/css`](https://tsdown.dev/options/css).

Like `css.inject` in `@tsdown/css`, the `inject` option is disabled by default; `inject: true`
injects a relative `import "./bundle.css"` into the entry chunks that use vanilla-extract styles —
through rolldown's native magic-string, so sourcemaps stay intact. `inject: {nodeCompat: true}`
additionally wires up the whole conditional CSS export pattern: the injected import becomes the
self-referential `import "<pkg>/bundle.css"`, a no-op `bundle.css.js` shim (plus
`bundle.css.d.ts`) is emitted for the `node`/`default` conditions of the export to point at, so
the import is harmless in runtimes that cannot import `.css` files, and when tsdown's
[`exports` feature](https://tsdown.dev/options/package-exports) is enabled, the conditional
`"./bundle.css"` export is written to `package.json` (`browser`/`style` → the real CSS,
`node`/`default` → the shim) through the plugin's `tsdownConfig` hook.

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

If you're using [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/%40sanity/tsdown-config#vanilla-extract),
prefer its `vanillaExtract` option instead: it uses this plugin under the hood with the defaults
most Sanity libraries want - `inject: {nodeCompat: true}`, and tsdown's `exports` feature already
enabled so the conditional `"./bundle.css"` export is maintained automatically.

## Options

The options are modeled after the [`css` options of `@tsdown/css`](https://tsdown.dev/options/css),
so they feel familiar in a tsdown config:

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
   * Minify the extracted CSS with lightningcss, like `css.minify` (which defaults to false).
   * @defaultValue true
   */
  minify: true,
  /**
   * CSS syntax lowering target, in esbuild-style strings like `css.target`. Defaults to tsdown's
   * top-level `target`. When neither is configured — or when the targets don't include any
   * browsers (e.g. `'node20'`, which speaks to the JS runtime, not the browsers the CSS runs
   * in) — the targets are resolved from `@sanity/browserslist-config` instead, where
   * `@tsdown/css` would silently skip syntax lowering. Set to `false` to disable lowering.
   */
  target: 'chrome90',
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

## Acknowledgements

The plugin combines a port of
[`@vanilla-extract/rollup-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin)
(MIT licensed, Copyright (c) 2021 SEEK) with the CSS collection and emission architecture of
[`@tsdown/css`](https://github.com/rolldown/tsdown/tree/main/packages/css) (MIT licensed,
Copyright (c) 2025-present VoidZero Inc. & Contributors, Copyright (c) 2024 Kevin Deng). The full
combined license notices are in this package's [LICENSE](./LICENSE) file.
