---
'@sanity/pkg-utils': patch
---

Materialize generated package export conditions in both `exports` and `publishConfig.exports`,
then preserve the user-authored order of each map independently on later builds, including nested
runtime conditions.
