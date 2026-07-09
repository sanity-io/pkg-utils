---
'@sanity/pkg-utils': minor
'@sanity/tsdown-config': minor
---

feat: ship a self-contained TypeScript toolchain, drop the `typescript` peer dependency

`@sanity/pkg-utils` no longer uses (or constrains) the `typescript` install of the consuming project. Instead it ships its own toolchain:

- The classic JS compiler API (used for parsing `tsconfig.json` and the `api-extractor` dts pipeline) comes from the official [`@typescript/typescript6`](https://www.npmjs.com/package/@typescript/typescript6) compat package, since TypeScript 7 (the Go-native compiler) no longer provides it.
- `dts: 'rolldown'` always generates types with the Go-native compiler (`tsgo`) from the bundled `typescript` v7 dependency (via `rolldown-plugin-dts` 0.27). The `tsgo` config option is deprecated: it's always enabled, and `tsgo: false` is ignored with a warning. `@typescript/native-preview` is no longer needed.

This removes the `typescript` peer dependency from both `@sanity/pkg-utils` and `@sanity/tsdown-config`, so any TypeScript version (or none at all) can be installed in the consuming project without peer range conflicts, and new TypeScript releases no longer require an updated peer range here.

Note that builds now use the bundled compilers regardless of the locally installed TypeScript version. If a `tsconfig.json` relies on compiler options that TypeScript 6 deprecates (e.g. `baseUrl`, `moduleResolution: "node"`), the `api-extractor` dts pipeline will report those deprecation errors even if an older TypeScript is installed locally.
