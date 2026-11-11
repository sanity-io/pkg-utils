---
"@sanity/pkg-utils": patch
"@sanity/tsdown-config": patch
"@sanity/vanilla-extract-integration": patch
---

fix(deps): update the rolldown/tsdown toolchain to latest (tsdown ^0.23.7, rolldown ~1.3.1, vite ^8.3.8, @vitejs/plugin-react ^6.3.0, @rolldown/plugin-babel ^0.3.1)

- `@sanity/pkg-utils` passes `dts.tsc.newContext` and `dts.dtsOnly` instead of the options rolldown-plugin-dts 0.29/0.30 deprecated, and drops a leftover top-level `newContext` so the two levels cannot conflict. A declaration-only build that sets `dts.entry` applies that filter to the build inputs and omits `entry`, because rolldown-plugin-dts 0.30 rejects `entry` together with `dtsOnly`.
- `@sanity/tsdown-config`'s TSDoc check includes every `@types/*` package again when the tsconfig doesn't set `types`. API Extractor 7.60 bundles TypeScript 6, which defaults `types` to `[]`, so declarations that use an ambient global such as `React.JSX.Element` crashed the check with "Unable to follow symbol". The package now depends on API Extractor `^7.60.0`; 7.59 bundles TypeScript 5.9, which treats `types: ['*']` as a package name.
- `PackageCssOptions` no longer includes tsdown's new `css: false` value.
- Direct `tsdown` builds that keep the legacy `main`/`module` fields now get `"types": "./dist/index.d.cts"` instead of `./dist/index.d.ts`, matching `main`. tsdown always preferred the CJS declarations for this field; rolldown-plugin-dts 0.30 no longer hides them. `pkg build` writes the hand-written `types` value back after the canonical build, so packages built with `@sanity/pkg-utils` keep that field.
