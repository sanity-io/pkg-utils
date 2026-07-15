---
"@sanity/tsdown-config": minor
---

Expose tsdown's experimental `css` option on `PackageOptions` and forward it as-is (requires `@tsdown/css` in the project — this package does not depend on it). Safe to combine with `vanillaExtract` for packages that use both vanilla-extract and CSS modules; the pipelines write to `bundle.css` and `style.css` by default and do not collide.
