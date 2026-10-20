# @sanity/pandacss-tsdown-plugin

## 0.3.1

### Patch Changes

- [#3659](https://github.com/sanity-io/pkg-utils/pull/3659) [`94fe359`](https://github.com/sanity-io/pkg-utils/commit/94fe359d9f1f19644b3b60205dad2753a8e5c229) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency postcss to ^8.5.31

## 0.3.0

### Minor Changes

- [#3648](https://github.com/sanity-io/pkg-utils/pull/3648) [`654ebee`](https://github.com/sanity-io/pkg-utils/commit/654ebee6351c539feff370acb638f56c8e37797b) Thanks [@stipsan](https://github.com/stipsan)! - Add `removeCascadeLayers()`, exported from the new `@sanity/pandacss-tsdown-plugin/vite` entry: the Vite counterpart of `cascadeLayers: false`, for packages that build with the plugin and also run their Panda sources through the official `@pandacss/vite` plugin, in a dev server, a Storybook or Vitest's browser mode. Registered next to `@pandacss/vite` with the names of the Panda config's layers (`removeCascadeLayers(['reset', 'base', 'tokens', 'recipes', 'utilities'])`), it removes those layers from the CSS `@pandacss/vite` generates with the same pass as the build, so that output cascades like the published `bundle.css`, and leaves every other layer alone. `vite` is an optional peer dependency, which only the new entry needs.

### Patch Changes

- [#3649](https://github.com/sanity-io/pkg-utils/pull/3649) [`4e744d0`](https://github.com/sanity-io/pkg-utils/commit/4e744d00768fd657e0caf6f2dd2a3da9dd293ce4) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency postcss to ^8.5.30

## 0.2.0

### Minor Changes

- [#3646](https://github.com/sanity-io/pkg-utils/pull/3646) [`95ad65a`](https://github.com/sanity-io/pkg-utils/commit/95ad65a64c67d632ba79cda5cbf6a5efc80f5b31) Thanks [@stipsan](https://github.com/stipsan)! - Add a `cascadeLayers` option, which defaults to `true`: the stylesheet keeps Panda's cascade layers, as before. Set `cascadeLayers: false` to publish the stylesheet without any `@layer` blocks or statements, so consumers can override its base styles with plain CSS or `styled()` without also overriding its `:hover`, `:focus-visible` and other states, which unlayered consumer CSS beats in a layered stylesheet. The rules are ordered so that source order gives them the precedence Panda's layers gave them, and every selector keeps its specificity, unlike with Panda's `polyfill`, which raises it. The layers are removed last, from the CSS Lightning CSS printed, by moving the rules out of their `@layer` blocks in a PostCSS tree: Lightning CSS and any `lightningcss.visitor` see Panda's layered output, and every rule keeps the text Lightning CSS gave it. See the README for the trade-offs.

  The plugin now rejects an option it doesn't have instead of ignoring it, so an option of a newer `@sanity/tsdown-config` than the installed plugin is reported, and exports `PANDACSS_PLUGIN_OPTION_NAMES`, the names of its options, for hosts that pass options through.

## 0.1.1

### Patch Changes

- [#3642](https://github.com/sanity-io/pkg-utils/pull/3642) [`158b317`](https://github.com/sanity-io/pkg-utils/commit/158b317bc5e6d2f395f828c47f75063fedd5b347) Thanks [@stipsan](https://github.com/stipsan)! - Fix several cases where styles were missed or the build output was wrong:

  - Entries that only use patterns, config recipes or `token()` now get the stylesheet import with `transform: false`, and a watch rebuild drops the import again once a module stops using Panda.
  - Panda now transforms modules before the other plugins' transforms (such as a React Compiler), so it reads the authored source: Panda JSX keeps its styles even when another plugin lowers JSX.
  - With tsdown, the generated `styled-system` files are written after tsdown's `clean` step, so `clean` may list them, and again for every `build()` that reuses the plugin.
  - The `outdir` option now also applies to Panda's default import map, so calls imported from that directory are extracted, also after a config reload in watch mode. The config it loads goes through a private temporary directory that only exists while Panda loads it, and builds that share the plugin and reload at the same time share one reload.
  - `target` accepts tsdown's `'baseline-widely-available'` alias, like `css.target` in `@tsdown/css`.
  - A symlinked project directory (also with rolldown's `resolve.symlinks: false`), a relative `cwd` and `include` globs with `..` segments no longer leave modules untransformed.
  - `fileName` accepts a `./` prefix and dot-prefixed names, and a name outside the output directory is rejected.
  - With `exports`, an output directory outside the package fails with an explanation instead of writing an invalid export, and your own `customExports` now runs after the stylesheet export is added, so an entry it writes for the stylesheet wins.
  - Watch mode keeps a Windows network-share (UNC) output directory out of the watcher.

## 0.1.0

### Minor Changes

- [#3639](https://github.com/sanity-io/pkg-utils/pull/3639) [`da36413`](https://github.com/sanity-io/pkg-utils/commit/da36413af1730826e4eccc17188cab022e186331) Thanks [@stipsan](https://github.com/stipsan)! - Initial release: a [tsdown](https://tsdown.dev) plugin for publishing [Panda CSS](https://panda-css.com) libraries to npm with a separate stylesheet.

  Add it to the `tsdown.config.ts` of a library build. Applications keep using `@pandacss/vite`.

  What it does when the library builds:

  - runs Panda's codegen, so the generated `styled-system` files match the config the build uses (`codegen: false` opts out)
  - rewrites the style calls that can be resolved statically — `css()`, `cva()`, patterns and recipes — into class name strings; calls with dynamic values stay as runtime calls and produce build warnings
  - extracts the generated CSS into a single stylesheet, optimized with Lightning CSS

  Optional, off by default:

  - `minify` to minify the stylesheet
  - `target` to transform the CSS syntax for specific browsers; it defaults to tsdown's `target` when that names browsers
  - `inject` to add an import of the stylesheet to the entry chunks that use Panda styles
  - `exports` to publish the stylesheet as the `./bundle.css` export of the package; `{nodeCompat: true}` makes it a conditional export whose `node` and `default` conditions resolve a no-op JS shim, so the import also loads in Node.js

  Setup: install `@sanity/pandacss-tsdown-plugin` next to `tsdown`. `@pandacss/dev` is recommended — for the usual `"prepare": "panda codegen"` script and the `panda` CLI — but not required.
