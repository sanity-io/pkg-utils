---
"@sanity/pkg-utils": patch
"@sanity/tsdown-config": patch
---

fix: preserve side-effect-only imports of external packages

Tree-shaking no longer sets the equivalent of `moduleSideEffects: 'no-external'` and instead relies on the bundler's default (`moduleSideEffects: true`). Previously, binding-less side-effect imports of external package subpaths — e.g. `import 'react-time-ago/locale/en'` — were stripped from the output, breaking consumers that depended on those side effects. `package.json` `sideEffects` fields are still honored for bundled modules, so dead-code elimination is unaffected.
