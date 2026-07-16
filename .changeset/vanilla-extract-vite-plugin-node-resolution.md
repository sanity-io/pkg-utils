---
'@sanity/vanilla-extract-vite-plugin': patch
---

fix: pin Node resolve conditions in the compiler server, so CLI hosts like Sanity Studio keep their vanilla-extract CSS

The internal compiler server that evaluates `.css.ts` modules now pins Node-shaped module
resolution instead of inheriting whatever the consuming app's Vite config (and Vite's own
defaults) imply, fixing two regressions against `@vanilla-extract/vite-plugin` when the plugin
runs inside the Sanity CLI ([#3073](https://github.com/sanity-io/pkg-utils/issues/3073)):

- **`sanity build` silently dropped all vanilla-extract CSS** (class names kept working, rules
  vanished — e.g. `@sanity/google-maps-input`'s dialog losing its `height: 40rem`). Vite's
  default `ssr.resolve.externalConditions` (`['node', 'module-sync']`) resolved the
  externalized `@vanilla-extract/*` packages to their CJS `default` exports, whose wrappers
  pick a dev or prod build off `NODE_ENV` at first load. A CLI host imports this plugin (and
  through it `@vanilla-extract/css`) before `vite build` flips `NODE_ENV` to `production`, so
  the evaluated `.css.ts` modules bound the compilation adapter to the dev copy while
  `style()` appended CSS through the prod copy's mock adapter. The compiler now resolves with
  `['node', 'import', 'module', 'default']`, preferring the single-file ESM builds — one
  adapter instance, CSS intact.
- **`sanity schema extract` crashed** (`Error: module is not defined`) because the CLI's
  schema-extraction worker sets `ssr.noExternal: true`, which the compiler inherited — inlining
  CJS dependencies that Vite's native `ModuleRunner` (unlike the legacy `vite-node`) cannot
  evaluate. The parent `ssr` and `environments` options are no longer forwarded to the
  compiler server.

Both are covered by the new `@integration/vanilla-extract-studio` suite, which runs a real
studio fixture through `sanity dev`, `sanity build`, and `sanity schema extract` with this
plugin and with `@vanilla-extract/vite-plugin` as the reference, comparing emitted CSS, class
names, and extracted schemas across identifier (`short`/`debug`/custom prefix function),
`build.cssMinify`, and `build.cssTarget` variants.
