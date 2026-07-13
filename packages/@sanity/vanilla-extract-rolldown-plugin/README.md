# @sanity/vanilla-extract-rolldown-plugin

A [rolldown](https://rolldown.rs) plugin for [vanilla-extract](https://vanilla-extract.style), built
for bundling libraries that ship pre-extracted CSS. Unlike
[`@vanilla-extract/rollup-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin)
it doesn't declare `rollup` as a peer dependency, so using it in rolldown-based toolchains (like
[tsdown](https://tsdown.dev)) doesn't pull in a second bundler. It also uses
[plugin hook filters](https://rolldown.rs/apis/plugin-api#plugin-hook-filters), so rolldown skips
the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related
([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)).

The plugin always extracts the CSS of all `.css.ts` modules into a single file (`bundle.css` by
default), optimized for the configured `browserslist` targets and minified with
[lightningcss](https://lightningcss.dev). In compat mode (the default) it also emits a no-op
`bundle.css.js` shim (plus `bundle.css.d.ts`) that the `node`/`default` conditions of a conditional
`"./bundle.css"` export can point at, so `import "<pkg>/bundle.css"` is a harmless no-op in runtimes
that cannot import `.css` files.

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

If you're using [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/%40sanity/tsdown-config#vanilla-extract),
prefer its `vanillaExtract` option instead: it uses this plugin under the hood and also wires up the
self-referential CSS import and the conditional `package.json` export.

## Options

```ts
vanillaExtractPlugin({
  /**
   * Formatting of identifiers (class names, keyframes, CSS vars, etc).
   * @defaultValue 'short'
   */
  identifiers: 'short',
  extract: {
    /**
     * Name of the emitted CSS file.
     * @defaultValue 'bundle.css'
     */
    name: 'bundle.css',
    /**
     * Emit a `.css.map` sourcemap next to the CSS file.
     * @defaultValue true
     */
    sourcemap: true,
    /**
     * Emit the no-op `<name>.js` + `<name>.d.ts` shim for the conditional CSS export pattern.
     * @defaultValue true
     */
    compatMode: true,
  },
  /**
   * Minify the extracted CSS with lightningcss.
   * @defaultValue true
   */
  minify: true,
  /**
   * Browserslist query passed to lightningcss when optimizing the extracted CSS.
   * @defaultValue `@sanity/browserslist-config`
   */
  browserslist: ['> 0.2% and supports es6-module', 'last 2 versions', 'Firefox ESR', 'not dead'],
})
```

## Acknowledgements

The core of this plugin is a port of
[`@vanilla-extract/rollup-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin),
combined with ideas from
[`@vanilla-extract/vite-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/vite-plugin),
both MIT licensed, Copyright (c) 2021 SEEK.
