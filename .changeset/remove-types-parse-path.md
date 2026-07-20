---
'@sanity/pkg-utils': patch
---

Move `git-url-parse` to `devDependencies` so it is inlined into the CLI bundle and consumers no longer pull in its deprecated transitive `@types/parse-path` stub.
