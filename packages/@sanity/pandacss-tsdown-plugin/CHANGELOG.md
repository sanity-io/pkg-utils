# @sanity/pandacss-tsdown-plugin

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
