---
'@sanity/vanilla-extract-vite-plugin': patch
---

Keep the compiler alive while serving under Vite's experimental bundled dev mode (`experimental.bundledDev`, e.g. `sanity dev` with `unstable_bundledDev`). The `buildEnd` hook fires there as soon as the initial in-server bundle finishes — while the server keeps serving and compiles lazy chunks on demand — and closing the compiler at that point tore down the hot-channel invoke listeners its module runner depends on. The first `.css.ts`-matching module in an on-demand chunk (such as `@bynder/compact-view`'s plain `Styles.css.js`, see [sanity-io/plugins#1553](https://github.com/sanity-io/plugins/pull/1553)) then hung `processVanillaFile` until the 60s transport timeout and crashed the dev server with `Failed to compile lazy entry … transport invoke timed out`. No workaround plugin is needed anymore for packages that ship plain (non-vanilla-extract) `*.css.js` modules.
