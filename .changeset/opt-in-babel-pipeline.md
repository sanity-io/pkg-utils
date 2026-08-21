---
'@sanity/tsdown-config': minor
---

**Breaking:** the babel pipeline is opt-in. `reactCompiler` defaults to `transform: 'oxc'`, and `@rolldown/plugin-babel` + `@babel/core` are optional peer dependencies instead of dependencies. To stay on babel: set `transform: 'babel'` and `pnpm add -D @rolldown/plugin-babel @babel/core babel-plugin-react-compiler`.
