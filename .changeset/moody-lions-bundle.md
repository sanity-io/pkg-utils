---
"@sanity/tsdown-config": minor
---

feat: the `vanillaExtract` option is now powered by `@sanity/vanilla-extract-rolldown-plugin` instead of `@vanilla-extract/rollup-plugin`, so enabling it no longer pulls `rollup` (a peer dependency of the rollup plugin) into tsdown projects. The `cwd`, `esbuildOptions` and `unstable_injectFilescopes` options of the alpha `vanillaExtract` API have been removed
