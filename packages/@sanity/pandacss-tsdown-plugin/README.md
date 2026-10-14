# @sanity/pandacss-tsdown-plugin

A [tsdown](https://tsdown.dev) plugin for publishing [Panda CSS](https://panda-css.com) libraries to npm — the companion of the official [`@pandacss/vite`](https://panda-css.com/docs/installation/vite) plugin.

Applications keep using `@pandacss/vite` in their `vite.config.ts` (and `vitest.config.ts`, `sanity.cli.ts`, …); this plugin takes its place in the `tsdown.config.ts` of a package that ships Panda styles. It:

- loads `panda.config.ts` with Panda's node driver and scans the sources the config's `include`/`exclude` globs cover,
- rewrites their `css()`, `cva()`, pattern and recipe calls into static class name strings with [`@pandacss/transformer`](https://www.npmjs.com/package/@pandacss/transformer), so the published JavaScript carries no Panda runtime,
- emits the generated stylesheet as a single [`lightningcss`](https://lightningcss.dev)-optimized CSS file (`dist/bundle.css` by default), optionally lowered to the build's `target` and minified,
- and, when enabled, injects the CSS import into the entry chunks and publishes the file as a conditional `"./bundle.css"` export subpath — the same `inject`/`exports` pattern as [`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme), with options modeled after the [`css` options of `@tsdown/css`](https://tsdown.dev/options/css).

## Installation

```sh
pnpm add --save-dev @sanity/pandacss-tsdown-plugin @pandacss/dev @pandacss/transformer tsdown
```

`@pandacss/dev` and `@pandacss/transformer` are peer dependencies: the plugin uses the Panda version your package already develops against.

## Usage

The plugin does not run codegen. Like a Vite application, the package generates its `styled-system` directory from its `prepare` script, so it exists before tsdown runs (and before the type checker and the test runner need it):

```json
{
  "scripts": {
    "prepare": "panda codegen",
    "build": "tsdown"
  },
  "imports": {
    "#styled-system/*": "./styled-system/*/index.js"
  }
}
```

```ts
// panda.config.ts
import {defineConfig} from '@pandacss/dev'

export default defineConfig({
  include: ['./src/**/*.css.ts'],
  outdir: 'styled-system',
  importMap: '#styled-system',
  // …
})
```

```ts
// tsdown.config.ts
import {pandacssPlugin} from '@sanity/pandacss-tsdown-plugin'
import {defineConfig} from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  exports: true,
  plugins: [pandacssPlugin({inject: true, exports: {nodeCompat: true}})],
})
```

With [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#panda), the `panda` option does the same, with `inject: true` and `exports: {nodeCompat: true}` as the defaults and the CSS lowered for the [`@sanity/browserslist-config`](https://github.com/sanity-io/browserslist-config#readme) browsers when the build's `target` names none:

```ts
// tsdown.config.ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  panda: true,
})
```

Either way, make sure the extracted CSS survives tree-shaking in consumers by listing it in `sideEffects`:

```json
{
  "sideEffects": ["*.css"]
}
```

## What the build does

**Sources.** The config's `include`/`exclude` globs decide which modules are Panda sources, in two places: the plugin's `transform` hook declares them as its [hook filter](https://rolldown.rs/apis/plugin-api/hook-filters) (resolved against `cwd`), so rolldown never calls the hook for other modules, and the hook itself asks the driver before touching a module. Without `include` or `exclude` in the config nothing is scoped. The whole `include` set is scanned when a build starts — the transformer folds tokens and style objects across files, so a module's dependencies must be known before it is rewritten — and the stylesheet covers all of it, like `panda cssgen`.

**Transform.** Each Panda source is rewritten in place: `css({color: 'brand'})` becomes `"color_brand"`, so the published module no longer imports `#styled-system/css`. A composition the transformer cannot resolve statically is left as is, with a warning; it keeps calling Panda's runtime, which rolldown then bundles from the `styled-system` directory through the `imports` map. Set `transform: false` to skip the rewrite entirely and only extract the CSS.

**Stylesheet.** The CSS is requested for every Panda layer (`reset`, `base`, `tokens`, `recipes`, `utilities` — a library cannot know ahead of time which ones its sources end up using) but without the `@layer reset, base, …;` declaration, which would declare layers the file doesn't use; ordering the layers is the consuming application's call. The result always goes through `lightningcss`, which lowers it to the `target`, normalizes it, drops Panda's `--made-with-panda` marker (listed in `unusedSymbols` together with anything you pass there) and removes the rules and layers that leaves empty, and minifies it only when `minify: true`. The `polyfill` option (defaulting to the Panda config's) emits the CSS without layers instead.

**Output.** The stylesheet is emitted once per output format as `<outDir>/<fileName>`. With `inject`, every entry chunk whose module graph reaches a Panda source gets an `import "…/bundle.css"` (a `require()` in CJS output) prepended — relative to the chunk, or the self-referential `"<pkg-name>/bundle.css"` when the file is also published as an export subpath with `exports`. `exports: {nodeCompat: true}` additionally emits a no-op `bundle-css.js` shim and its `bundle-css.d.ts`, and writes the conditional export to `package.json` through tsdown's [`exports` feature](https://tsdown.dev/options/package-exports) when that is enabled:

```json
{
  "exports": {
    "./bundle.css": {
      "types": "./dist/bundle-css.d.ts",
      "browser": "./dist/bundle.css",
      "style": "./dist/bundle.css",
      "node": "./dist/bundle-css.js",
      "default": "./dist/bundle-css.js"
    }
  }
}
```

so `import "<pkg-name>/bundle.css"` resolves to the stylesheet in bundlers and browsers and to the harmless shim in Node and other runtimes that cannot load `.css` files.

## Options

| Option         | Type                                           | Default                       | Description                                                                                                                                                                                                               |
| -------------- | ---------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd`          | `string`                                       | tsdown's `cwd`                | The project root the Panda config is discovered from, and the directory its `include`/`exclude` globs are relative to (like `cwd` in `@pandacss/vite`).                                                                   |
| `configPath`   | `string`                                       | discovered upward from `cwd`  | An explicit Panda config file, relative to `cwd` (like `configPath` in `@pandacss/vite`).                                                                                                                                 |
| `transform`    | `boolean`                                      | `true`                        | Rewrite the style calls of the Panda sources into static class names (like `transform` in `@pandacss/vite`, which defaults to `false` there because applications keep the runtime around). `false` only extracts the CSS. |
| `polyfill`     | `boolean`                                      | the Panda config's `polyfill` | Emit the CSS without cascade layers (Panda's `@layer` polyfill).                                                                                                                                                          |
| `fileName`     | `string`                                       | `"bundle.css"`                | Name of the emitted CSS file (like `css.fileName` in `@tsdown/css`).                                                                                                                                                      |
| `minify`       | `boolean`                                      | `false`                       | Minify the CSS with `lightningcss` (like `css.minify` in `@tsdown/css`). The CSS is optimized by `lightningcss` either way.                                                                                               |
| `target`       | `string \| string[] \| false`                  | tsdown's resolved `target`    | esbuild-style CSS syntax lowering target(s), e.g. `'chrome90'` (like `css.target` in `@tsdown/css`). Browserless targets such as `'node20'` skip lowering; `false` disables it.                                           |
| `lightningcss` | `Omit<TransformOptions, 'filename' \| 'code'>` | —                             | Options passed through to `lightningcss`'s `transform()` (like `css.lightningcss` in `@tsdown/css`). `targets` wins over `target`; `unusedSymbols` extends the `--made-with-panda` entry the plugin always removes.       |
| `inject`       | `boolean`                                      | `false`                       | Prepend the CSS import to every entry chunk that reaches Panda styles (like `css.inject` in `@tsdown/css`).                                                                                                               |
| `exports`      | `boolean \| {nodeCompat?: boolean}`            | `false`                       | Publish the CSS file as the `"./<fileName>"` export subpath — plain with `true`, conditional with a Node-compatible shim with `{nodeCompat: true}` — and make `inject` use the self-referential specifier.                |

`@pandacss/vite`'s `outdir` option has no counterpart: it only directs codegen, which this plugin leaves to `panda codegen`.

## Compared to `@pandacss/vite`

Both load the same config with the same driver and transform sources with the same transformer, but they serve different phases. `@pandacss/vite` is an application plugin: it runs codegen, injects the stylesheet into the CSS file that declares Panda's layers, keeps the runtime around (its `transform` is opt-in) and handles HMR. This plugin is a library-build plugin: it emits the stylesheet as a file of its own next to the JavaScript, rewrites the sources so the package does not depend on the runtime, and wires the CSS up for consumers through the package's exports. A `.css` file that declares Panda's layers is not touched here — the consuming application's `@pandacss/vite` handles it.

## Related

- [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme) — the `panda` option wraps this plugin with Sanity's defaults.
- [`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme) — the same extract-and-publish model for vanilla-extract.

## License

MIT © [Sanity.io](https://www.sanity.io/)
