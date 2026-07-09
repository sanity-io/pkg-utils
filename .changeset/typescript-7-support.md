---
'@sanity/pkg-utils': minor
'@sanity/tsdown-config': minor
'@sanity/parse-package-json': patch
---

feat: support TypeScript 7 (the Go-native compiler)

- The `typescript` peer dependency ranges now allow `7.0.x`.
- TypeScript 7 no longer ships the JS compiler API (`ts.sys`, `ts.createProgram`, etc), so `@sanity/pkg-utils` now loads the compiler API through the official [`@typescript/typescript6`](https://www.npmjs.com/package/@typescript/typescript6) compat package when the installed `typescript` doesn't provide it. Projects on TypeScript 5.8–6.0 keep using their installed compiler exactly as before.
- `rolldown-plugin-dts` is upgraded to 0.27.x: when TypeScript 7 is installed, `dts: 'rolldown'` automatically uses the native compiler (`tsgo`) for type generation, without needing `@typescript/native-preview`. Note that `tsgo: false` is not supported when TypeScript 7 is installed, as the non-tsgo code path depends on the removed JS compiler API.
