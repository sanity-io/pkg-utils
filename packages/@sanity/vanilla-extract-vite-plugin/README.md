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
  /**
   * How `.css.ts` modules are compiled during `vite dev`: one evaluation and one virtual
   * `.vanilla.css` module per `.css.ts` module (like `@vanilla-extract/vite-plugin`), or every
   * module under `roots` evaluated as one program and served as one stylesheet. See below.
   * `vite build` always compiles per module.
   * @defaultValue 'per-module'
   */
  compilation: 'whole-program',
  /**
   * The directories scanned for `.css.ts` modules in whole-program mode, relative to the Vite
   * root. `node_modules`, `dist` and `.git` are skipped.
   * @defaultValue the Vite root
   */
  roots: ['src'],
  /**
   * Render the declarations of `style()` rules as shared single-declaration classes, see
   * below. `{report: true}` logs a summary of the pass after each build or program render.
   * @defaultValue false
   */
  atomic: {report: true},
})
```

## Whole-program compilation

With `compilation: 'whole-program'` the dev server's compiler evaluates every `.css.ts` module
under `roots` (plus any the browser requests that discovery missed) as one program on the shared
module runner, renders one stylesheet and serves it as a single virtual CSS module. Modules
render in dependency order, then discovery order (sorted paths), with every conditional block
after every unconditional rule — the same order `@sanity/vanilla-extract-rolldown-plugin`
produces in its whole-program mode, so `sanity dev` and the library build agree, and a later
module's base rule no longer beats an earlier module's media rule. Class names and exports are
unchanged. Editing a `.css.ts` module swaps that one stylesheet; only the members whose
serialized JS actually changed are invalidated (Vite still re-transforms the dependents of the
edited file, as it does per module). Unreferenced pure compositions are stripped like in library
builds, since the whole program knows every selector.

`vite build` keeps compiling per module: Vite's CSS pipeline orders and splits CSS by module
graph and chunk, which a single program order cannot be expressed through.

## Atomic classes

`atomic: true` renders the declarations of `style()` rules as shared single-declaration classes
and expands the exported class lists with them (identity class first, like vanilla-extract's own
style composition), sharing a class only where that cannot change what any element renders as —
see [`@sanity/vanilla-extract-rolldown-plugin`](../vanilla-extract-rolldown-plugin/README.md#atomic-classes)
for the contract. Per module, classes are shared within a `.css.ts` module's file scope; in
whole-program mode, across the program.

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
