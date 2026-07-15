---
'@sanity/tsdown-config': minor
---

Expose tsdown's `clean` option on `PackageOptions` so packages can clean folders before build (prefer `clean: ['dist', …]` over a separate `package.json` `"clean"` script) without `mergeConfig`
