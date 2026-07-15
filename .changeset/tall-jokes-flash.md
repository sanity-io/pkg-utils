---
'@sanity/vanilla-extract-rolldown-plugin': minor
'@sanity/vanilla-extract-tsdown-plugin': minor
---

feat: the rolldown-generic core of `@sanity/vanilla-extract-tsdown-plugin` is split into a new package, `@sanity/vanilla-extract-rolldown-plugin`. The new package contains everything that only needs rolldown: the `.css.ts` compilation with plugin hook filters, the single-file `lightningcss`-optimized CSS extraction, and the whole `inject` wiring (the relative import, and the `nodeCompat` self-referential import plus no-op shim emission) — so it can be used from raw rolldown (or Vite build-only library setups via `build.rolldownOptions.plugins`) without depending on tsdown. Its peer dependency is `rolldown` (optional) instead of `tsdown`, and host tools can provide resolved defaults (`target`, `packageName`, `cwd`) through the plugin's `api.setBuildContext()`.

`@sanity/vanilla-extract-tsdown-plugin` is now a thin tsdown adapter over the new package with an unchanged public API: it forwards tsdown's resolved config (the top-level `target` as the default CSS syntax lowering target, the resolved package name for the self-referential import, and `cwd`) through its `tsdownConfigResolved` hook, and keeps writing the conditional `"./<fileName>"` export to `package.json` through `exports.customExports` in its `tsdownConfig` hook when tsdown's `exports` feature is enabled.
