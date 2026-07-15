---
"@sanity/pkg-utils": patch
"@sanity/vanilla-extract-rolldown-plugin": patch
"@sanity/vanilla-extract-tsdown-plugin": patch
"@sanity/vanilla-extract-vite-plugin": patch
---

fix(deps): update dependency rolldown to v1.2.0

Also bumps `@vanilla-extract/vite-plugin` to `^5.2.5` in the benchmark/playground
comparison baselines (already-latest `@vanilla-extract/css`, `integration`, and
`rollup-plugin` left unchanged). Patch releases for the vanilla-extract plugins
republish their READMEs, which link to the refreshed benchmark results.
