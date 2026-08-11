---
'@sanity/parse-package-json': patch
'@sanity/pkg-utils': patch
---

Keep a `default` fallback inside generated `browser` and `node` export conditions so resolvers
cannot backtrack to the platform-neutral build when their module-format condition is inactive.
Allow these nested fallbacks in the public package export types.
