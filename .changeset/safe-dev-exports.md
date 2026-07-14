---
'@sanity/tsdown-config': patch
---

Only enable `devExports: true` by default when the project package manager is detected as pnpm, preventing npm and other package managers from publishing source-only exports.
