---
"@sanity/vanilla-extract-rolldown-plugin": minor
"@sanity/vanilla-extract-tsdown-plugin": patch
"@sanity/pkg-utils": patch
"@sanity/tsdown-config": patch
---

Stop emitting a redundant `bundle.css.d.ts` alongside the vanilla-extract CSS shim.

The conditional `./bundle.css` export already has an explicit `types` condition pointing at `bundle-css.d.ts`, so TypeScript never needs a sibling declaration for the CSS file itself. Compat mode now emits only that one declaration (plus `bundle-css.js` and `bundle.css`).

`cssFileDtsFileName` is no longer exported from `@sanity/vanilla-extract-rolldown-plugin` (0.x breaking API change → minor).
