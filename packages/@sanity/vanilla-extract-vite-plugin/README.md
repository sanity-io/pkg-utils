# @sanity/vanilla-extract-vite-plugin

A [Vite](https://vite.dev) 8 plugin for [vanilla-extract](https://vanilla-extract.style)
applications: it compiles `.css.ts` modules and feeds their CSS into Vite's own CSS pipeline
(PostCSS, code-splitting, HMR, SSR) as virtual `.vanilla.css` modules — a rolldown-era
alternative to
[`@vanilla-extract/vite-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/vite-plugin):

- **Plugin hook filters** on `transform`/`resolveId`/`load`
  ([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)),
  so rolldown-based Vite 8 skips the Rust ↔ JS roundtrip for every module that isn't
  vanilla-extract related — the main source of the `PLUGIN_TIMINGS` build warnings with the
  upstream plugin.
- **A caching compiler on Vite's Environment API /
  [ModuleRunner](https://vite.dev/guide/api-environment-runtimes#modulerunner)** instead of the
  legacy `vite-node`: `.css.ts` modules are evaluated through an internal Vite server and cached
  in its module graph, so rebuilds and HMR only re-evaluate what changed.
- **The environment-aware
  [`hotUpdate` hook](https://vite.dev/guide/api-environment-plugins#the-hotupdate-hook)**
  instead of the deprecated `handleHotUpdate`.

Head-to-head numbers against `@vanilla-extract/vite-plugin` — `vite build` across minify/target
variants, dev HMR, and a hook-filter stress sweep — live in the
[vanilla-extract benchmarks](https://github.com/sanity-io/pkg-utils/tree/main/benchmarks/vanilla-extract#latest-results).

For _libraries_ that ship a single pre-extracted CSS file, use
[`@sanity/vanilla-extract-rolldown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-rolldown-plugin#readme)
(raw rolldown) or
[`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme)
(tsdown) instead — this plugin is for application dev servers and app builds.

## Usage

```sh
pnpm add --save-dev @sanity/vanilla-extract-vite-plugin @vanilla-extract/css
```

```ts
// vite.config.ts
import {vanillaExtractPlugin} from '@sanity/vanilla-extract-vite-plugin'
import {defineConfig} from 'vite'

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
})
```

Requires Vite 8. For older Vite versions, use `@vanilla-extract/vite-plugin`.

## Options

```ts
vanillaExtractPlugin({
  /**
   * Formatting of identifiers (class names, keyframes, CSS vars, etc).
   * @defaultValue 'short' when `mode` is 'production', 'debug' otherwise
   */
  identifiers: 'short',
  /**
   * Which of your Vite plugins are re-instantiated inside the compiler server that evaluates
   * the `.css.ts` modules. By default no plugins are forwarded (and the filtering work is
   * skipped entirely) - most plugins don't affect `.css.ts` evaluation, and forwarding them
   * would run every transform twice. Vite's own options (like `resolve.tsconfigPaths`) still
   * apply to the compiler server through the forwarded config.
   */
  pluginFilter: ({name, mode}) => name === 'my-css-ts-affecting-plugin',
  /**
   * How the extracted CSS reaches the page during development. 'emitCss' (the default) serves
   * it through Vite's CSS pipeline; 'inlineCssInDev' additionally inlines all extracted CSS
   * into a <style> tag in the served HTML, preventing a flash of unstyled content in dev SSR
   * setups. Builds behave the same in both modes.
   * @defaultValue 'emitCss'
   */
  mode: 'emitCss',
})
```

## tsconfig paths

Unlike `@vanilla-extract/vite-plugin`, this plugin does **not** forward the
`vite-tsconfig-paths` plugin into its compiler server by default. On Vite 8, tsconfig path
resolution is a built-in feature — prefer enabling
[`resolve.tsconfigPaths`](https://vite.dev/config/shared-options#resolve-tsconfigpaths) in your
`vite.config.ts`, which applies to the compiler server automatically (Vite options are forwarded
as-is, only plugins are filtered):

```ts
// vite.config.ts
export default defineConfig({
  resolve: {tsconfigPaths: true},
  plugins: [vanillaExtractPlugin()],
})
```

If you need the `vite-tsconfig-paths` plugin regardless (e.g. for options the built-in doesn't
cover), forward it explicitly with a `pluginFilter`:

```ts
vanillaExtractPlugin({
  pluginFilter: ({name}) => name === 'vite-tsconfig-paths',
})
```

## Acknowledgements

The plugin is a port of
[`@vanilla-extract/vite-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/vite-plugin)
and its compiler is a port of
[`@vanilla-extract/compiler`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/compiler)
onto Vite's Environment API (both MIT licensed, Copyright (c) 2021 SEEK). The full combined
license notices are in this package's [LICENSE](./LICENSE) file.
