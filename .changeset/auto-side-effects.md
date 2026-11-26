---
"@sanity/tsdown-config": minor
"@sanity/pkg-utils": minor
---

feat: auto-generate `package.json#sideEffects` from the build

`@sanity/tsdown-config` now rewrites `sideEffects` after every build from the CSS assets,
`.css.js` chunks, and JS files that import stylesheets the build produced. When nothing is
side-effectful the field is set to `false`. Opt out with `sideEffects: false` to leave the
field untouched. `@sanity/pkg-utils` forwards the same option from `package.config.ts`.
