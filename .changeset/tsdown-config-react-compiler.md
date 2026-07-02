---
"@sanity/tsdown-config": minor
---

feat: add the `babel.reactCompiler` option known from `@sanity/pkg-utils`

Runs `babel-plugin-react-compiler` on the source files before they are bundled, so published components are memoized automatically. Like in `@sanity/pkg-utils`, enable it with `babel: {reactCompiler: true}` and configure the compiler with `reactCompilerOptions`. Requires `babel-plugin-react-compiler` to be installed.
