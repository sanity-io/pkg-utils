---
'@sanity/pkg-utils': patch
---

fix the deprecated transitive `@types/parse-path` stub by replacing `git-url-parse` with a small local git URL parser used by `pkg init`.
