---
'@sanity/pkg-utils': patch
---

For conditional entries, materialize generated package export conditions in both `exports` and
`publishConfig.exports`, then preserve the user-authored order of each map independently on later
builds, including nested runtime conditions. Plain-string entries retain their compact shape.
