---
'@sanity/pkg-utils': major
'@sanity/tsdown-config': major
---

feat: support TypeScript 7 (the Go-native compiler), require TypeScript 6 or later

**BREAKING**: the `typescript` peer dependency range is now `6.x || 7.x` — TypeScript 5.x is no longer supported. TypeScript 7 is not required yet, but 6.0 is the new minimum.

- The classic JS compiler API (used for parsing `tsconfig.json` and the `api-extractor` dts pipeline) is now always loaded from the official [`@typescript/typescript6`](https://www.npmjs.com/package/@typescript/typescript6) compat package (a regular dependency), since TypeScript 7 no longer ships it. The installed `typescript` peer no longer affects that pipeline.
- `dts: 'rolldown'` upgrades to `rolldown-plugin-dts` 0.27.x: with `typescript` v7 installed, type generation automatically uses the Go-native compiler (`tsgo`) from the `typescript` package itself, without needing `@typescript/native-preview`. With v6, the previous behavior is unchanged (`tsgo` is opt-in via the `tsgo` option or `@typescript/native-preview` in `devDependencies`, and `tsgo: false` still opts out).
