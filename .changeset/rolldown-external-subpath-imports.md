---
'@sanity/pkg-utils': patch
---

fix: preserve subpath imports of external packages in rolldown dts output

Bare specifiers are now matched against their package name when deciding externals in the rolldown dts pipeline, so subpath imports of external dependencies (e.g. `@sanity/client/stega`) keep their original specifier instead of resolving to an absolute filesystem path in the emitted declarations.
