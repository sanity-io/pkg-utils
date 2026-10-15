# @sanity/pandacss-tsdown-plugin

A [tsdown](https://tsdown.dev) plugin for publishing [Panda CSS](https://panda-css.com) libraries to npm with a separate stylesheet.

It is for library builds: add it to the `tsdown.config.ts` of a package that styles with Panda, and it generates Panda's files, rewrites the style calls it can resolve statically into class names, and extracts the CSS into one Lightning CSS-optimized file next to the JavaScript. Applications keep using the official [`@pandacss/vite`](https://panda-css.com/docs/installation/vite) plugin in their Vite config; the two load the same `panda.config.ts`.

## Installation

```sh
pnpm add --save-dev @sanity/pandacss-tsdown-plugin tsdown
```

- `tsdown` is a peer dependency. The Panda compiler and transformer the plugin runs are its own dependencies, so there is nothing else to install for the build.
- `@pandacss/dev` is recommended but not required (an optional peer): it provides `defineConfig` for `panda.config.ts`, the `"prepare": "panda codegen"` script below, and the `panda` CLI for debugging, such as validating the config.
- Node.js 22.18 or later, like tsdown and Panda.

## Quick start

A package with Panda sources under `src/`:

```json
{
  "name": "my-library",
  "type": "module",
  "files": ["dist"],
  "sideEffects": ["*.css"],
  "imports": {
    "#styled-system/*": "./styled-system/*/index.js"
  },
  "scripts": {
    "prepare": "panda codegen",
    "build": "tsdown"
  }
}
```

- `imports` maps the generated `styled-system` directory, so sources import `#styled-system/css`.
- `prepare` generates that directory on install. The plugin regenerates it when it builds, but the editor, the type checker and the test runner need it before any build runs.
- `sideEffects` keeps the stylesheet import that `inject` adds from being tree-shaken by consumers' bundlers.

```ts
// panda.config.ts
import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  include: ['./src/**/*.ts', './src/**/*.tsx'],
  importMap: '#styled-system',
  hash: true,
  preflight: false,
  presets: [],
  jsxStyleProps: 'none',
  shorthands: false,
  forceImportExtension: true,
  strictPropertyValues: true,
  // …
} satisfies Config)
```

`satisfies Config` makes the type checker reject options that don't exist, which `defineConfig` alone lets through.

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

This build writes `dist/index.js` with the style calls rewritten, `dist/bundle.css` with the extracted CSS, and — because of the two options — an `import "my-library/bundle.css"` at the top of the entry chunk plus the conditional `./bundle.css` export in `package.json` (see [Loading the stylesheet](#loading-the-stylesheet)). tsdown's `exports: true` is what lets the plugin write that export; without it, the export has to be maintained by hand.

Used standalone, the plugin only extracts the CSS: `inject` and `exports` are off by default, and so is `minify`.

## Using it through `@sanity/tsdown-config`

[`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#panda) wraps the plugin in its `panda` option, with Sanity's defaults on top: `inject: true`, `exports: {nodeCompat: true}`, and CSS syntax transformed for the [`@sanity/browserslist-config`](https://github.com/sanity-io/browserslist-config#readme) browsers when the build's `target` names none. Minification stays opt-in.

```ts
// tsdown.config.ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  panda: true,
})
```

Pass an object instead of `true` to customize, with the same [options](#options) as the plugin.

## What the build does

### Sources

The Panda config's `include` and `exclude` globs decide which modules are Panda sources. Every file they cover is scanned when a build starts and contributes to the stylesheet — also files no entry imports, like `panda cssgen`. Modules outside the globs are left alone, even when they call `css()`.

### Codegen

Before anything is scanned or transformed, the plugin writes Panda's generated files (the same output as `panda codegen`) to the config's `outdir`, so the generated types, runtime and class name hashes match the config the stylesheet is extracted with. Only files whose content changed are written; a current directory is left untouched. Set `codegen: false` to leave codegen to your own scripts, and `outdir` to write the files elsewhere.

### Transform

By default (`transform: true`, unlike `@pandacss/vite`, where it is off), each Panda source is rewritten in place: `css({color: 'brand'})` becomes `"color_brand"`, so the module no longer imports `#styled-system/css`. Set `transform: false` to keep every call and only extract the CSS.

Only calls that can be resolved statically are rewritten:

- A conditional composition like `css(base, active && extra)` is resolved into a static expression, or into a call of a small class-merging helper from `@pandacss/transformer` that is bundled into the output — not Panda's full runtime.
- A call with a dynamic value, like `css({color})`, cannot be resolved. It stays as it is, Panda's `css()` runtime is bundled into the output for it (from `styled-system`, through the `imports` map), and the build warns about it. The runtime call produces a class name, but the stylesheet only has rules for the values Panda could see statically — arbitrary dynamic values have none.

### Stylesheet

The CSS is extracted into `bundle.css` (the `fileName` option) once per output format:

- Every Panda cascade layer is requested, and the output keeps the `@layer` blocks of the layers that have rules — but not the `@layer reset, base, tokens, recipes, utilities;` order declaration. Declaring the order is the consuming application's job (Panda apps do this in their own CSS). Set `polyfill: true` to emit the CSS without layers instead, for browsers that predate `@layer`.
- Lightning CSS always processes the result: it transforms the syntax for the configured browsers (see [Browser targets](#browser-targets)), normalizes it, and removes Panda's `--made-with-panda` marker together with the rules and layers that leaves empty.
- Minification is separate and off by default; set `minify: true`.

### Browser targets

Which syntax Lightning CSS transforms depends on the targets:

- `target` takes esbuild-style targets like `'chrome90'` or `['chrome90', 'safari16.2']`. It defaults to tsdown's own `target`, and a browser named more than once resolves to its lowest version.
- A target that doesn't specify browsers, such as `node20`, means no syntax transform — the plugin matches `@tsdown/css` here. `@sanity/tsdown-config` falls back to `@sanity/browserslist-config` in that case, and also accepts browserslist queries like `'defaults'`.
- `lightningcss.targets` wins over `target`; `target: false` disables the syntax transform.

### Loading the stylesheet

Consumers have to load `bundle.css`. The plugin can help in two ways, both off by default:

- `inject: true` adds an import of the stylesheet to every JavaScript entry chunk whose module graph reaches a module with Panda styles — `import "./bundle.css"` in ESM output, `require("./bundle.css")` in CJS output, inserted after `"use strict"` and other directives. The CSS is not inlined into the JavaScript and no `<style>` element is created; the consumer's bundler handles the import.
- `exports: true` publishes the stylesheet as the `./bundle.css` export of the package, and `inject` then uses the self-referential `import "my-library/bundle.css"`. With `exports: {nodeCompat: true}` the export is conditional: the `browser` and `style` conditions select the stylesheet, while `node` and `default` select a no-op `bundle-css.js` shim (with a `bundle-css.d.ts` for `types`), so the import resolves in runtimes that cannot load `.css` files. The export is written to `package.json` through tsdown's [`exports` feature](https://tsdown.dev/options/package-exports) when that is enabled.

Loading through `exports` relies on the consumer's resolver honoring those conditions; bundlers generally do, plain `<script type="module">` in a browser does not.

### Watch mode

In `tsdown --watch`, the plugin watches every scanned source (imported or not), the directories the `include` globs are rooted in (so added files are picked up), and the Panda config with its imports. A rebuild reloads the config: a change to it regenerates the files, re-extracts the stylesheet and transforms every module again — class renames (`prefix`, `hash`, `separator`) and `include` changes reach the output on the next rebuild. The generated directory and the build's output directory are excluded from watching, so the build's own writes don't trigger the next one.

## Options

| Option         | Type                                           | Default                       | Description                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd`          | `string`                                       | tsdown's `cwd`                | Where `panda.config.ts` is looked up, and what its `include`/`exclude` globs are relative to.                                                                                                                    |
| `configPath`   | `string`                                       | discovered upward from `cwd`  | An explicit Panda config file, relative to `cwd`.                                                                                                                                                                |
| `codegen`      | `boolean`                                      | `true`                        | Write Panda's generated files when a build starts. See [Codegen](#codegen).                                                                                                                                      |
| `outdir`       | `string`                                       | the Panda config's `outdir`   | Where the generated files are written, relative to `cwd`. Not tsdown's `outDir`, which is where the build output goes.                                                                                           |
| `transform`    | `boolean`                                      | `true`                        | Rewrite statically resolvable style calls into class names. `false` only extracts the CSS. See [Transform](#transform).                                                                                          |
| `polyfill`     | `boolean`                                      | the Panda config's `polyfill` | Emit the CSS without cascade layers.                                                                                                                                                                             |
| `fileName`     | `string`                                       | `"bundle.css"`                | Name of the stylesheet, written to tsdown's output directory.                                                                                                                                                    |
| `minify`       | `boolean`                                      | `false`                       | Minify the stylesheet. Lightning CSS processes it either way.                                                                                                                                                    |
| `target`       | `string \| string[] \| false`                  | tsdown's `target`             | Browsers to transform the CSS syntax for, esbuild-style; `false` disables the transform. See [Browser targets](#browser-targets).                                                                                |
| `lightningcss` | `Omit<TransformOptions, 'filename' \| 'code'>` | —                             | Options passed through to Lightning CSS. `targets` wins over `target`; `unusedSymbols` is added to the `--made-with-panda` marker the plugin removes; `cssModules` is always off, since Panda names the classes. |
| `inject`       | `boolean`                                      | `false`                       | Add an import of the stylesheet to the entry chunks that use Panda styles. See [Loading the stylesheet](#loading-the-stylesheet).                                                                                |
| `exports`      | `boolean \| {nodeCompat?: boolean}`            | `false`                       | Publish the stylesheet as the `./<fileName>` export, conditional with a Node.js shim when `nodeCompat` is set. See [Loading the stylesheet](#loading-the-stylesheet).                                            |

`@pandacss/vite`'s `cwd`, `configPath` and `outdir` have the same meaning here. Its `transform` exists too but is on by default, since a published package should not depend on Panda's runtime where it can avoid it.

## Advanced

- **How modules are selected.** The plugin tells rolldown which modules to hand to its transform hook from the config's `include`/`exclude` globs (the fast-glob subset Panda configs use: `**`, `*`, `?`, `{a,b}`, `[…]`; anything else, and watch mode, let the hook see every module), and always asks Panda's own matcher before touching one. The decision is Panda's either way.
- **Other hosts.** The plugin is a rolldown plugin with two tsdown hooks on top. A host that isn't tsdown can pass what tsdown would through `plugin.api.setBuildContext({target, packageName, cwd, outDir})`; without it, `target` has no default, the package name for `exports` comes from the nearest `package.json`, and the output directory is not excluded from watching.
- **Helpers.** `createCssExport`, `createConditionalCssExport` and `insertCssExport` build and insert the `./<fileName>` export; `cssShimFileName`, `cssShimDtsFileName`, `cssShimSource` and `cssShimDtsSource` describe the Node.js shim; `esbuildTargetToLightningCSS` converts esbuild-style targets; `resolveCssExportOptions` resolves `inject`/`exports`. They are exported for hosts that integrate the same CSS export pattern.

## Related

- [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#panda) — the `panda` option wraps this plugin with Sanity's defaults.
- [`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme) — the same extract-and-publish model for vanilla-extract.

## License

MIT © [Sanity.io](https://www.sanity.io/)
