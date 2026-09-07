---
"@sanity/tsdown-config": patch
"@sanity/vanilla-extract-tsdown-plugin": patch
"@sanity/parse-package-json": patch
"@sanity/pkg-utils": patch
"@sanity/vanilla-extract-integration": patch
"@sanity/vanilla-extract-rolldown-plugin": patch
"@sanity/vanilla-extract-vite-plugin": patch
---

fix(deps): update tsdown to ^0.23.0 and adapt to TsdownHandle

tsdown 0.23's `build()` returns `{bundles, watch}` instead of `TsdownBundle[]`.
pkg-utils now takes `.bundles` from that handle.
