# @sanity/vanilla-extract-vite-plugin

## 0.2.5

### Patch Changes

- Updated dependencies [[`f180e02`](https://github.com/sanity-io/pkg-utils/commit/f180e022908ad555756e013b20cb589a34703954)]:
  - @sanity/vanilla-extract-integration@0.1.5

## 0.2.4

### Patch Changes

- [#3096](https://github.com/sanity-io/pkg-utils/pull/3096) [`aac3364`](https://github.com/sanity-io/pkg-utils/commit/aac3364216b6c0f3d361d4068da0224c3335ab0f) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.12

- [#3085](https://github.com/sanity-io/pkg-utils/pull/3085) [`900431f`](https://github.com/sanity-io/pkg-utils/commit/900431f065bf1359ebce66c47c6c8a41d11b6071) Thanks [@stipsan](https://github.com/stipsan)! - Keep the compiler alive while serving under Vite's experimental bundled dev mode (`experimental.bundledDev`, e.g. `sanity dev` with `unstable_bundledDev`). The `buildEnd` hook fires there as soon as the initial in-server bundle finishes — while the server keeps serving and compiles lazy chunks on demand — and closing the compiler at that point tore down the hot-channel invoke listeners its module runner depends on. The first `.css.ts`-matching module in an on-demand chunk (such as `@bynder/compact-view`'s plain `Styles.css.js`, see [sanity-io/plugins#1553](https://github.com/sanity-io/plugins/pull/1553)) then hung `processVanillaFile` until the 60s transport timeout and crashed the dev server with `Failed to compile lazy entry … transport invoke timed out`. No workaround plugin is needed anymore for packages that ship plain (non-vanilla-extract) `*.css.js` modules.

  The compiler is instead closed when the dev server itself shuts down (the http server's `close` event), so its internal Vite server and file watcher no longer outlive `server.close()` and keep the process alive.

- Updated dependencies [[`aac3364`](https://github.com/sanity-io/pkg-utils/commit/aac3364216b6c0f3d361d4068da0224c3335ab0f)]:
  - @sanity/vanilla-extract-integration@0.1.4

## 0.2.3

### Patch Changes

- [#3089](https://github.com/sanity-io/pkg-utils/pull/3089) [`412881b`](https://github.com/sanity-io/pkg-utils/commit/412881b552f8c5315c12d961da903b4836581646) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.11

- Updated dependencies [[`412881b`](https://github.com/sanity-io/pkg-utils/commit/412881b552f8c5315c12d961da903b4836581646)]:
  - @sanity/vanilla-extract-integration@0.1.3

## 0.2.2

### Patch Changes

- Updated dependencies [[`102d159`](https://github.com/sanity-io/pkg-utils/commit/102d159b0710363a37176560a1cc3d5b70f651cf)]:
  - @sanity/vanilla-extract-integration@0.1.2

## 0.2.1

### Patch Changes

- [#3077](https://github.com/sanity-io/pkg-utils/pull/3077) [`9ec6ff3`](https://github.com/sanity-io/pkg-utils/commit/9ec6ff3c27fb26da8265cbd3733a0260ee833baa) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.9

- [#3076](https://github.com/sanity-io/pkg-utils/pull/3076) [`8b22c7c`](https://github.com/sanity-io/pkg-utils/commit/8b22c7cc1bf8e89ee379ec4b0a01e5c9b44cbbe1) Thanks [@stipsan](https://github.com/stipsan)! - fix: pin Node resolve conditions in the compiler server, so CLI hosts like Sanity Studio keep their vanilla-extract CSS

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

- Updated dependencies [[`691f5f8`](https://github.com/sanity-io/pkg-utils/commit/691f5f8d2072c6b1f9effd2243cf38c20b66ba6f), [`9ec6ff3`](https://github.com/sanity-io/pkg-utils/commit/9ec6ff3c27fb26da8265cbd3733a0260ee833baa)]:
  - @sanity/vanilla-extract-integration@0.1.1

## 0.2.0

### Minor Changes

- [#3058](https://github.com/sanity-io/pkg-utils/pull/3058) [`685f9c6`](https://github.com/sanity-io/pkg-utils/commit/685f9c6015ba69c9efcb201745a395bf663088b4) Thanks [@stipsan](https://github.com/stipsan)! - Vendor `@vanilla-extract/integration` onto the rolldown toolchain as `@sanity/vanilla-extract-integration`, and consume it from both plugins. The `compile()` child compilation of `.css.ts` graphs now runs on rolldown instead of esbuild (making library builds with the rolldown/tsdown plugin ~1.5x faster on the benchmark suite), debug IDs are injected by an offset-splicing AST pass over `yuku-parser`'s oxc-shaped AST instead of `@vanilla-extract/babel-plugin-debug-ids` (yuku parsed ~2x faster than `rolldown/parseAst` in the reproducible corpus bench-off, and the yuku toolchain is already transitive via rolldown-plugin-dts), and the `eval`, `find-up`, `dedent`, and `mlly` dependencies are replaced with `node:vm` and inlined equivalents — dropping `@babel/core`, `esbuild`, and their subtrees from the plugins' production dependency graphs entirely.

### Patch Changes

- Updated dependencies [[`3020923`](https://github.com/sanity-io/pkg-utils/commit/30209234b7b8ce6bbb5a3895747d1522d5ee2605), [`685f9c6`](https://github.com/sanity-io/pkg-utils/commit/685f9c6015ba69c9efcb201745a395bf663088b4)]:
  - @sanity/vanilla-extract-integration@0.1.0

## 0.1.1

### Patch Changes

- [#3046](https://github.com/sanity-io/pkg-utils/pull/3046) [`bfd86fa`](https://github.com/sanity-io/pkg-utils/commit/bfd86fa8bcd52ed01bfc0cd5302376f5ae09088d) Thanks [@stipsan](https://github.com/stipsan)! - fix(deps): update dependency rolldown to v1.2.0

  Also bumps `@vanilla-extract/vite-plugin` to `^5.2.5` in the benchmark/playground
  comparison baselines (already-latest `@vanilla-extract/css`, `integration`, and
  `rollup-plugin` left unchanged). Patch releases for the vanilla-extract plugins
  republish their READMEs, which link to the refreshed benchmark results.

## 0.1.0

### Minor Changes

- [#3032](https://github.com/sanity-io/pkg-utils/pull/3032) [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a) Thanks [@stipsan](https://github.com/stipsan)! - feat: initial release of `@sanity/vanilla-extract-vite-plugin`, a Vite 8 application plugin for vanilla-extract that compiles `.css.ts` modules and feeds their CSS into Vite's own CSS pipeline (PostCSS, code-splitting, HMR, SSR) as virtual `.vanilla.css` modules. Compared to `@vanilla-extract/vite-plugin` it declares plugin hook filters on its `transform`/`resolveId`/`load` hooks so rolldown-based Vite 8 skips the Rust ↔ JS roundtrip for unrelated modules ([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)), uses the environment-aware `hotUpdate` hook instead of the deprecated `handleHotUpdate`, and evaluates `.css.ts` modules through a caching compiler built on Vite's Environment API / `ModuleRunner` instead of the legacy `vite-node` — `.css.ts` modules are cached in the internal server's module graph and invalidated per file on change. Supports `identifiers`, a `pluginFilter` controlling which of the consumer's Vite plugins are forwarded to the compiler server (none by default — the filtering work is skipped entirely without a `pluginFilter`, and Vite 8's built-in `resolve.tsconfigPaths` replaces the `vite-tsconfig-paths` plugin upstream forwards, applying to the compiler server automatically through the forwarded config), and `mode: 'inlineCssInDev'` for FOUC-free dev SSR. The caching compiler is also exported as `createCompiler` for other Vite-based tooling.
