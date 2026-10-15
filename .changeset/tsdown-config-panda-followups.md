---
'@sanity/tsdown-config': patch
---

Fix how CSS targets and the `panda` option resolve:

- `target: 'baseline-widely-available'` now transforms the CSS of `vanillaExtract`, `panda` and `css` for the browsers tsdown expands it to, instead of the `@sanity/browserslist-config` fallback.
- `panda` reads the top-level `target` from the final config, so a `target` you set with `mergeConfig()` after `defineConfig()` decides the browsers. An explicit `panda.target` or `panda.lightningcss.targets` still wins.
- `panda` and `vanillaExtract` or `css` writing the same stylesheet is detected for `./`-prefixed names too, and a `css` option with `splitting` no longer counts as a conflict.
- Enabling `panda` without `@sanity/pandacss-tsdown-plugin` installed explains how to install it.

The target fixes apply with `@sanity/pandacss-tsdown-plugin` 0.1.0 as well.
