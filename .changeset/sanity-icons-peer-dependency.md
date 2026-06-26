---
'@sanity/pkg-utils': patch
---

feat: disallow `@sanity/icons` in `peerDependencies`

When running with `--strict`, `package.json` is now validated to ensure `@sanity/icons` is not declared in `peerDependencies` (use `dependencies` or `devDependencies` instead). The check defaults to `error` and can be configured via `noSanityIconsPeerDependency` in `strictOptions`.
