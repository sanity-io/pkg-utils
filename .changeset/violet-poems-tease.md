---
'@sanity/parse-package-json': patch
'@sanity/tsdown-config': patch
'@sanity/tsconfig': patch
---

fix: use a literal `@` instead of the percent-encoded `%40` in the `homepage` links to the `packages/@sanity/*` directories, so the URLs read cleanly in the npm UI (GitHub resolves both forms)
