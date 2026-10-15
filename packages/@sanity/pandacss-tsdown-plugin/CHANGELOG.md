# @sanity/pandacss-tsdown-plugin

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
