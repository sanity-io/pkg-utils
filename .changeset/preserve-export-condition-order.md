---
'@sanity/pkg-utils': patch
---

Preserve the authored order of package export conditions, including nested runtime conditions,
when local builds regenerate `exports` and `publishConfig.exports`.
