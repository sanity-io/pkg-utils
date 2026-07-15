---
"@sanity/vanilla-extract-rolldown-plugin": patch
"@sanity/vanilla-extract-tsdown-plugin": patch
"@sanity/pkg-utils": patch
"@sanity/tsdown-config": patch
---

Rename the vanilla-extract node/SSR CSS shim from `bundle.css.js` to `bundle-css.js`.

`bundle.css.js` matches vanilla-extract's `cssFileFilter` (`/\.css\.(js|…)$/`), so Vite plugins (notably `@sanity/vanilla-extract-vite-plugin` via Vite's `ModuleRunner`) would try to evaluate the empty shim as `.css.ts` output and throw. The public `./bundle.css` export subpath is unchanged; only the on-disk shim (and its `node`/`default` export targets) move to `bundle-css.js`, with matching `bundle-css.d.ts` / `bundle.css.d.ts` companions for both export targets. Rebuilding a package with compat mode on rewrites `package.json` automatically.
