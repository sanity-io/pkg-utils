---
'@sanity/tsdown-config': minor
---

Add a `panda` option that extracts the Panda CSS stylesheet with `@sanity/pandacss-tsdown-plugin`, an optional peer dependency. Like `vanillaExtract` and `css`, browserless CSS syntax lowering targets fall back to `@sanity/browserslist-config`; `minify`, `inject` and `exports` keep the plugin's defaults.
