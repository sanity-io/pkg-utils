---
"@sanity/vanilla-extract-integration": patch
---

fix: escape file paths and package names interpolated into `setFileScope(...)`, so quotes and other special characters cannot break out of the generated string literal

Ports [vanilla-extract#1785](https://github.com/vanilla-extract-css/vanilla-extract/pull/1785) (`ced6c58`).
