---
'@sanity/tsdown-config': minor
---

`vanillaExtract.minify` and `css.minify` no longer default to `true`. CSS is left unminified unless `minify: true` is set. The CSS syntax-lowering `target` default is unchanged.
