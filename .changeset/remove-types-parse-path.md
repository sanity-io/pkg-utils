---
'@sanity/pkg-utils': patch
---

Replace `git-url-parse` with zero-dependency `parse-github-url` (as a `devDependency`, inlined into the CLI bundle) so consumers no longer pull in the deprecated transitive `@types/parse-path` stub.
