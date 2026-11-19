---
"@sanity/vanilla-extract-integration": patch
"@sanity/vanilla-extract-rolldown-plugin": patch
"@sanity/vanilla-extract-vite-plugin": patch
---

fix: leave `*.css.js`/`*.css.ts` modules that aren't vanilla-extract modules as they are

A module whose name matches `*.css.(js|ts|…)` but that registers no vanilla-extract CSS and exports something that can't be serialized, like the function-exporting `*.css.js` helpers `@sentry/feedback` 11.13+ ships, no longer fails the build with `Invalid exports`. `processVanillaFile` and the compiler's `processVanillaFile` now resolve to a `null` source for such a module, and the plugins pass it through unchanged. A module that does register CSS still throws `InvalidExportsError` for an unserializable export.
