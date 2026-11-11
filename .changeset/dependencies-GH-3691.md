---
"@sanity/pkg-utils": patch
---

fix(deps): update dependency chokidar to v6

Chokidar 6 requires Node.js `>=22.22`, so `engines.node` is now `^22.22.0 || ^24.11.0 || >=26.0.0`. Node.js 22.18–22.21 can no longer run this package.
