---
'@sanity/tsdown-config': minor
---

**Breaking:** the babel pipeline is now opt-in. `reactCompiler` defaults to the `'oxc'` transform (`oxc-transform-react`, the Rust port), and the babel toolchain moved out of the dependency tree: `@rolldown/plugin-babel` and `@babel/core` are optional peer dependencies now, so packages that don't use `babel-plugin-react-compiler` never install babel at all. To keep running the reference implementation, set `transform: 'babel'` and install the toolchain: `pnpm add -D @rolldown/plugin-babel @babel/core babel-plugin-react-compiler`.
