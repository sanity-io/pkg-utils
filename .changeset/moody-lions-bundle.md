---
"@sanity/tsdown-config": minor
---

feat: the `vanillaExtract` option is now powered by `@sanity/vanilla-extract-tsdown-plugin` instead of `@vanilla-extract/rollup-plugin`, so enabling it no longer pulls `rollup` (a peer dependency of the rollup plugin) into tsdown projects. The alpha `vanillaExtract` options are now modeled after the `css` options of `@tsdown/css`: `extract.name` is now `fileName`, `browserslist` is now the esbuild-style `target` (defaulting to tsdown's top-level `target`, then `@sanity/browserslist-config`), `extract.compatMode` is now `inject`, and CSS sourcemaps (`extract.sourcemap`) are no longer emitted, aligned with `@tsdown/css`. The `cwd`, `esbuildOptions` and `unstable_injectFilescopes` options have been removed
