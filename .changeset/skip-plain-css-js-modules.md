---
'@sanity/vanilla-extract-integration': patch
'@sanity/vanilla-extract-vite-plugin': patch
'@sanity/vanilla-extract-rolldown-plugin': patch
---

Skip plain (non-vanilla-extract) `*.css.js` modules that match `cssFileFilter` by filename only — for example `@bynder/compact-view`'s `Styles.css.js`.

Previously the Vite plugin (and the rolldown/`compile` filescope transform) treated every `*.css.js` as a vanilla-extract module, injecting `@vanilla-extract/css/adapter` / `fileScope`. Under pnpm that import often cannot be resolved from the dependency's nested `node_modules`, so `sanity build` failed with `Cannot find module '@vanilla-extract/css/adapter'`.

The earlier [#3085](https://github.com/sanity-io/pkg-utils/pull/3085) fix kept the compiler alive under `unstable_bundledDev` so those modules no longer hung the dev server; this change stops processing them as vanilla-extract at all when their source does not reference `@vanilla-extract/`.
