---
"@sanity/pkg-utils": patch
---

fix: emit `.d.ts` files for vanilla-extract `bundle.css` export targets

In compat mode, pkg-utils now writes declaration companions alongside the extracted CSS and the no-op JS shim:

- `<css>.d.ts` for the `browser` / `style` targets
- `<css>.js.d.ts` for the `node` / `default` shim target

This prevents downstream `dts-exports` tooling from crashing when it resolves `./bundle.css` exports to missing declaration files (e.g. `bundle.css.d.ts` derived from the `default` `./bundle.css.js` path).
