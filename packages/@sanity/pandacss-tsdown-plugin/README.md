# @sanity/pandacss-tsdown-plugin

A [tsdown](https://tsdown.dev) plugin for publishing [Panda CSS](https://panda-css.com) libraries to npm with a separate stylesheet.

It is for library builds: add it to the `tsdown.config.ts` of a package that styles with Panda, and it generates Panda's files, rewrites the style calls it can resolve statically into class names, and extracts the CSS into one Lightning CSS-optimized file next to the JavaScript. Applications keep using the official [`@pandacss/vite`](https://panda-css.com/docs/installation/vite) plugin in their Vite config, or its wrapper from [`@sanity/pandacss-tsdown-plugin/vite`](#vite-plugin), which generates the CSS into a virtual stylesheet and can remove its cascade layers like this plugin does; they all load the same `panda.config.ts`.

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

Before anything is scanned or transformed, the plugin writes Panda's generated files (the same output as `panda codegen`) to the config's `outdir`, so the generated types, runtime and class name hashes match the config the stylesheet is extracted with. Under tsdown this happens once for all formats, after tsdown's `clean` step and before any build starts: `clean` may list the generated directory, and the separate CJS declaration build finds the generated types. Only files whose content changed are written; a current directory is left untouched. Set `codegen: false` to leave codegen to your own scripts, and `outdir` to write the files elsewhere.

### Transform

By default (`transform: true`, unlike `@pandacss/vite`, where it is off), each Panda source is rewritten in place: `css({color: 'brand'})` becomes `"color_brand"`, so the module no longer imports `#styled-system/css`. Set `transform: false` to keep every call and only extract the CSS.

Only calls that can be resolved statically are rewritten:

- A conditional composition like `css(base, active && extra)` is resolved into a static expression, or into a call of a small class-merging helper from `@pandacss/transformer` that is bundled into the output — not Panda's full runtime.
- A call with a dynamic value, like `css({color})`, cannot be resolved. It stays as it is, Panda's `css()` runtime is bundled into the output for it (from `styled-system`, through the `imports` map), and the build warns about it. The runtime call produces a class name, but the stylesheet only has rules for the values Panda could see statically — arbitrary dynamic values have none.

### Stylesheet

The CSS is extracted into `bundle.css` (the `fileName` option) once per output format:

- Every Panda cascade layer is requested, and the output keeps the `@layer` blocks of the layers that have rules — but not the `@layer reset, base, tokens, recipes, utilities;` order declaration. Declaring the order is the consuming application's job (Panda apps do this in their own CSS). Set `cascadeLayers: false` to publish the CSS without layers instead (see [Cascade layers](#cascade-layers)).
- Lightning CSS always processes the result: it transforms the syntax for the configured browsers (see [Browser targets](#browser-targets)), normalizes it, and removes Panda's `--made-with-panda` marker together with the rules and layers that leaves empty.
- Minification is separate and off by default; set `minify: true`.
- With `cascadeLayers: false`, the layers are removed last, from the CSS Lightning CSS printed (minified or not), so Lightning CSS and any `lightningcss.visitor` still see Panda's layered stylesheet.

### Cascade layers

Panda puts its rules in cascade layers, and the stylesheet keeps them by default: `cascadeLayers` defaults to `true`, here and in `@sanity/tsdown-config`'s `panda` option. `@sanity/tsdown-config` plans to switch its default to `false` in a later release of its own, once `@sanity/ui` and `sanity` have adopted the option.

For a published library, the layers have a cost: CSS outside any layer beats every layered rule, whatever its specificity. A consumer who overrides a base style with an unlayered rule — even `button { font-weight: inherit }` in a reset such as Tailwind's preflight — also overrides the library's `:hover`, `:focus-visible` and selected states, so focus rings, hover colors and bold weights disappear.

`cascadeLayers: false` removes every `@layer` block and statement. The library's rules then cascade like any unlayered CSS, by specificity and then source order, the way a vanilla-extract or plain CSS stylesheet does:

- A consumer rule overrides a base style when it is at least as specific and loads after the library's stylesheet — `button {…}` beats a global `button` style, and a one-class override such as `styled(Button)` beats a recipe's `.button` base.
- The library's state rules (`.button:is(:hover, [data-hover])`) are more specific than a one-class override, so they keep winning.
- Every selector is left as Panda wrote it, so no rule gets more specific than it was.

The rules are reordered so that source order gives them the precedence the layers gave them: `reset`, `base`, `tokens`, `recipes` and `utilities` in that order, and within a layer, its sublayers before its own rules. Panda depends on the latter: it emits the `compositions` sublayer (text and layer styles) after the utilities that must beat it, and recipes as `base`, `variants` and `compound_variants` sublayers, with slot recipes in a separate `recipes.slots` block. A `@media`, `@supports` or `@container` block that holds layers is split along them, each part keeping its condition, so the order holds across it too.

This is the last step of the build, on the CSS Lightning CSS printed: the stylesheet is parsed with [PostCSS](https://postcss.org), the rules are moved out of their `@layer` blocks and the result is printed again, so every rule keeps the text Lightning CSS gave it — the same syntax transforms, merging and minification as with the layers on, and the same formatting at the rules' new indentation. Nothing is matched textually: a `@layer` inside a custom property's value or a string is data, and the layer names (escapes, comments and all) are read by Lightning CSS's parser.

Source order can't reproduce everything layers do, though:

- A more specific rule in an earlier layer, which used to lose to a later layer, now wins. In Panda's output, that is a recipe's base state style: `_hover` in a recipe's `base` (`.button:is(:hover, [data-hover])`) now beats its variants (`.button--tone_brand`) and utilities (`.color_ink`) while hovered. Declare states in the variants to keep them in step.
- `!important` declarations no longer reverse the layer order: the later of two `!important` declarations wins, like normal ones.
- Load order matters for consumers: an override has to load after the library's stylesheet, or be more specific.

Keep the layers when the consumers are Panda apps, or other apps that declare a layer order of their own: they can place the library's layers among theirs (`@layer reset, base, tokens, recipes, utilities, app;`) and rank the library's rules below or above their own as a whole, which source order can't give them. Keeping the layers never shields the library's rules from unlayered CSS, though — a layered rule yields to every normal unlayered declaration, whatever its specificity, so a consumer's `button {…}` overrides the library's states as well as its base styles. Turn the layers off for a library meant to be overridden with plain CSS, styled-components or a reset such as Tailwind's preflight: the base styles then yield to an override at least as specific, and the more specific state rules keep winning. The option works with `minify`, `target`, `inject`, `exports` and watch mode, and with `lightningcss.visitor`, whose visitors receive the layered stylesheet, since the layers are removed after Lightning CSS has run. It takes precedence over the Panda config's `polyfill`.

Panda's own `polyfill` option is no substitute: it emulates the layer order by appending `:not(#\#)` chains to every selector, one more ID for each layer. That keeps the library's own precedence, but even its global `button` style becomes as specific as an ID selector (and its utilities as ten), so no consumer rule short of `!important` can override it. The two options can't be combined.

A Storybook, a Vitest browser suite or another Vite app that builds the library's sources instead of loading `bundle.css` gets the same unlayered stylesheet from `cascadeLayers: false` of the [Vite plugin](#vite-plugin).

### Browser targets

Which syntax Lightning CSS transforms depends on the targets:

- `target` takes esbuild-style targets like `'chrome90'` or `['chrome90', 'safari16.2']`, and tsdown's `'baseline-widely-available'`. It defaults to tsdown's own `target`, and a browser named more than once resolves to its lowest version.
- A target that doesn't specify browsers, such as `node20`, means no syntax transform — the plugin matches `@tsdown/css` here. `@sanity/tsdown-config` falls back to `@sanity/browserslist-config` in that case, and also accepts browserslist queries like `'defaults'`.
- `lightningcss.targets` wins over `target`; `target: false` disables the syntax transform.

### Loading the stylesheet

Consumers have to load `bundle.css`. The plugin can help in two ways, both off by default:

- `inject: true` adds an import of the stylesheet to every JavaScript entry chunk whose module graph reaches a module with Panda styles (`css()`, `cva()`, `sva()`, pattern, recipe and `token()` calls, or Panda JSX) — `import "./bundle.css"` in ESM output, `require("./bundle.css")` in CJS output, inserted after `"use strict"` and other directives. The CSS is not inlined into the JavaScript and no `<style>` element is created; the consumer's bundler handles the import.
- `exports: true` publishes the stylesheet as the `./bundle.css` export of the package, and `inject` then uses the self-referential `import "my-library/bundle.css"`. With `exports: {nodeCompat: true}` the export is conditional: the `browser` and `style` conditions select the stylesheet, while `node` and `default` select a no-op `bundle-css.js` shim (with a `bundle-css.d.ts` for `types`), so the import resolves in runtimes that cannot load `.css` files. The export is written to `package.json` through tsdown's [`exports` feature](https://tsdown.dev/options/package-exports) when that is enabled.

Loading through `exports` relies on the consumer's resolver honoring those conditions; bundlers generally do, plain `<script type="module">` in a browser does not.

### Watch mode

In `tsdown --watch`, the plugin watches every scanned source (imported or not), the directories the `include` globs are rooted in (so added files are picked up), and the Panda config with its imports. A rebuild reloads the config: a change to it regenerates the files, re-extracts the stylesheet and transforms every module again — class renames (`prefix`, `hash`, `separator`) and `include` changes reach the output on the next rebuild. The generated directory and the build's output directory are excluded from watching, so the build's own writes don't trigger the next one.

## Options

| Option          | Type                                           | Default                       | Description                                                                                                                                                                                                      |
| --------------- | ---------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd`           | `string`                                       | tsdown's `cwd`                | Where `panda.config.ts` is looked up, and what its `include`/`exclude` globs are relative to. A relative path is resolved against tsdown's `cwd`.                                                                |
| `configPath`    | `string`                                       | discovered upward from `cwd`  | An explicit Panda config file, relative to `cwd`.                                                                                                                                                                |
| `codegen`       | `boolean`                                      | `true`                        | Write Panda's generated files before the build starts. See [Codegen](#codegen).                                                                                                                                  |
| `outdir`        | `string`                                       | the Panda config's `outdir`   | Where the generated files are written, relative to `cwd`; replaces the config's `outdir`, default import map included. Not tsdown's `outDir`, which is where the build output goes.                              |
| `transform`     | `boolean`                                      | `true`                        | Rewrite statically resolvable style calls into class names. `false` only extracts the CSS. See [Transform](#transform).                                                                                          |
| `polyfill`      | `boolean`                                      | the Panda config's `polyfill` | Emit the CSS without cascade layers, through Panda's polyfill, which raises the specificity of every rule. See [Cascade layers](#cascade-layers).                                                                |
| `cascadeLayers` | `boolean`                                      | `true`                        | Keep Panda's cascade layers. `false` removes them and orders the rules by layer, leaving every selector's specificity as it was. See [Cascade layers](#cascade-layers).                                          |
| `fileName`      | `string`                                       | `"bundle.css"`                | Name of the stylesheet, written to tsdown's output directory.                                                                                                                                                    |
| `minify`        | `boolean`                                      | `false`                       | Minify the stylesheet. Lightning CSS processes it either way.                                                                                                                                                    |
| `target`        | `string \| string[] \| false`                  | tsdown's `target`             | Browsers to transform the CSS syntax for, esbuild-style; `false` disables the transform. See [Browser targets](#browser-targets).                                                                                |
| `lightningcss`  | `Omit<TransformOptions, 'filename' \| 'code'>` | —                             | Options passed through to Lightning CSS. `targets` wins over `target`; `unusedSymbols` is added to the `--made-with-panda` marker the plugin removes; `cssModules` is always off, since Panda names the classes. |
| `inject`        | `boolean`                                      | `false`                       | Add an import of the stylesheet to the entry chunks that use Panda styles. See [Loading the stylesheet](#loading-the-stylesheet).                                                                                |
| `exports`       | `boolean \| {nodeCompat?: boolean}`            | `false`                       | Publish the stylesheet as the `./<fileName>` export, conditional with a Node.js shim when `nodeCompat` is set. See [Loading the stylesheet](#loading-the-stylesheet).                                            |

`@pandacss/vite`'s `cwd`, `configPath` and `outdir` have the same meaning here. Its `transform` exists too but is on by default, since a published package should not depend on Panda's runtime where it can avoid it.

An option the plugin doesn't have is an error, not something it ignores — a typo, or an option of a newer `@sanity/tsdown-config` than the installed plugin supports (`cascadeLayers` set to anything but a boolean is one). `PANDACSS_PLUGIN_OPTION_NAMES` exports the names of the options, for hosts that pass options through and want to check them the same way.

## Vite plugin

`@sanity/pandacss-tsdown-plugin/vite` is for the Vite side of the same sources: an app, a Storybook or a Vitest browser suite that builds Panda sources with Vite, such as the sources of a library that publishes its stylesheet with this plugin. It exports `pandacss()`, a drop-in replacement for `pandacss()` from the official `@pandacss/vite`, which it wraps, with two additions:

- **No hand-written stylesheet.** `@pandacss/vite` generates the CSS into a stylesheet the app writes itself, which it recognizes by a statement that declares Panda's layers, such as `@layer reset, base, tokens, recipes, utilities;`. The wrapper provides that stylesheet as the virtual module `virtual:panda.css`, with the layer names of the Panda config, renamed ones included.
- **`cascadeLayers: false`.** It removes the cascade layers from the generated stylesheet with the same pass as the tsdown plugin's [`cascadeLayers: false`](#cascade-layers), so the app cascades like the published `bundle.css`.

```sh
pnpm add --save-dev @sanity/pandacss-tsdown-plugin @pandacss/vite vite
```

`@pandacss/vite` and `vite` are optional peer dependencies, which only this entry needs.

```ts
// vite.config.ts
import {pandacss} from '@sanity/pandacss-tsdown-plugin/vite'
import {defineConfig} from 'vite'

export default defineConfig({
  plugins: [pandacss({transform: true, cascadeLayers: false})],
})
```

Import the stylesheet once, at the top of the app's entry, before anything that loads other CSS:

```ts
// src/main.tsx
import 'virtual:panda.css'
import {createRoot} from 'react-dom/client'

// …
```

- **Load order.** Without layers, Panda's rules compete with the app's other CSS by specificity and source order, so the stylesheet has to load first, before the `<style>` elements styled-components adds at runtime, for example. Imported first, it does: in `vite dev`, Vite injects stylesheets in the order the modules import them, and in `vite build` the entry's CSS file is linked from the `<head>`, ahead of anything a script adds.
- **Storybook.** Import it at the top of `.storybook/preview.tsx`, and add the plugin in `viteFinal`.
- **Vitest browser mode.** Add the plugin to the Vitest config, and import the stylesheet in a [setup file](https://vitest.dev/config/setupfiles) (`test.setupFiles`), which runs before every test file.
- **TypeScript.** The `vite/client` types (`/// <reference types="vite/client" />`) declare every `*.css` import, `virtual:panda.css` included. `PANDA_STYLESHEET` exports the specifier, for tooling that adds the import itself.

| Option          | Type      | Default                      | Description                                                                                                                                                                    |
| --------------- | --------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cwd`           | `string`  | Vite's `root`                | Passed to `@pandacss/vite`: where `panda.config.ts` is looked up.                                                                                                              |
| `configPath`    | `string`  | discovered upward from `cwd` | Passed to `@pandacss/vite`: an explicit Panda config file, relative to `cwd`.                                                                                                  |
| `outdir`        | `string`  | the Panda config's `outdir`  | Passed to `@pandacss/vite`: where the generated files are written.                                                                                                             |
| `transform`     | `boolean` | `false`                      | Passed to `@pandacss/vite`: rewrite the style calls into class names.                                                                                                          |
| `cascadeLayers` | `boolean` | `true`                       | Keep Panda's cascade layers. `false` removes them like the tsdown plugin's option. Can't be combined with the Panda config's `polyfill`.                                       |
| `banner`        | `string`  | —                            | CSS prepended to the stylesheet, on a line of its own, such as a `@layer` statement that orders the layers of other libraries' stylesheets (`@layer sui;`) ahead of their CSS. |

How it works:

- The wrapper returns two plugins: a companion plugin, which loads the Panda config `@pandacss/vite` loads (from the same `cwd` and `configPath`) for its layer names, and `@pandacss/vite` itself. The companion serves `virtual:panda.css`, which declares the layers; `@pandacss/vite` appends the generated CSS to it; and the companion then removes the layers (with `cascadeLayers: false`) and prepends the `banner`. `@pandacss/vite`'s transform comes first (`order: 'pre'`), and the companion's runs before Vite's own CSS pipeline (PostCSS, `@import` inlining, Lightning CSS minification) — in `vite dev`, `vite build` and Vitest's browser mode alike.
- A hand-written stylesheet that declares the layers keeps working: `@pandacss/vite` still fills it, and the companion rewrites it too. Replace its import with `virtual:panda.css` to delete the file. The layers of other stylesheets are left alone, including the ones a rewritten stylesheet `@import`s.
- In `vite dev`, an edit to the Panda config that renames the layers updates `virtual:panda.css` before `@pandacss/vite` reloads the page.
- An app that builds several Panda projects registers one `pandacss()` per project. They share `virtual:panda.css`, which declares the layers of every project's config, in the order of the plugins, and is rewritten once, so the instances must have the same `cascadeLayers` and `banner`.

## Advanced

- **How modules are selected.** The plugin tells rolldown which modules to hand to its transform hook from the config's `include`/`exclude` globs (the fast-glob subset Panda configs use: `**`, `*`, `?`, `{a,b}`, `[…]`; anything else, and watch mode, let the hook see every module), and always asks Panda's own matcher before touching one. The decision is Panda's either way. The transform hook runs ahead of other plugins' transforms (`order: 'pre'`, like `@pandacss/transformer`'s own bundler plugin), so Panda reads the authored source even when another plugin, such as a React Compiler, lowers JSX.
- **Other hosts.** The plugin is a rolldown plugin with two tsdown hooks on top. A host that isn't tsdown can pass what tsdown would through `plugin.api.setBuildContext({target, packageName, cwd, outDir})`; without it, `target` has no default, the package name for `exports` comes from the nearest `package.json`, and the output directory is not excluded from watching.- **Helpers.** `createCssExport`, `createConditionalCssExport` and `insertCssExport` build and insert the `./<fileName>` export; `cssShimFileName`, `cssShimDtsFileName`, `cssShimSource` and `cssShimDtsSource` describe the Node.js shim; `esbuildTargetToLightningCSS` converts esbuild-style targets; `resolveCssExportOptions` resolves `inject`/`exports`. They are exported for hosts that integrate the same CSS export pattern.

## Related

- [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#panda) — the `panda` option wraps this plugin with Sanity's defaults.
- [`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme) — the same extract-and-publish model for vanilla-extract.

## License

MIT © [Sanity.io](https://www.sanity.io/)
