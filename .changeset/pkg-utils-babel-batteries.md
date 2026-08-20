---
'@sanity/pkg-utils': patch
---

No behavior change from `@sanity/tsdown-config`'s new oxc default: `reactCompiler` keeps `'babel'` as its default transform, and the babel toolchain (`@rolldown/plugin-babel`, `@babel/core`) that tsdown-config made opt-in now ships with pkg-utils directly — as before, only the compiler itself (`babel-plugin-react-compiler`, or `oxc-transform-react` with `transform: 'oxc'`) needs to be installed.
