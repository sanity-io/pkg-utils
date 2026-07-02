---
"@sanity/tsdown-config": minor
---

feat: add the `vanillaExtract` option known from `@sanity/pkg-utils`

Enables `@vanilla-extract/rollup-plugin` to extract CSS from `.css.ts` files into a separate file that is optimized with `lightningcss`. Like in `@sanity/pkg-utils`, the compat mode (on by default) automatically injects the self-referential `import "<pkg>/bundle.css"` into the entry chunk, emits a no-op `bundle.css.js` shim (plus `bundle.css.d.ts`) for runtimes that cannot import `.css` files, and writes the conditional `"./bundle.css"` export (`browser`/`style` → the real CSS, `node`/`default` → the shim) to `package.json`.
