---
'@sanity/tsdown-config': minor
'@sanity/pkg-utils': minor
---

Add `reactCompiler.transform` to pick the React Compiler implementation: `'babel'` (the default, runs `babel-plugin-react-compiler`) or the experimental `'oxc'` (runs `oxc-transform-react`, the Rust port — one native pass for React Compiler + TypeScript/JSX). Both compilers are optional peer dependencies.
