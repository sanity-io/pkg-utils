---
"@sanity/vanilla-extract-rolldown-plugin": patch
"@sanity/vanilla-extract-tsdown-plugin": patch
"@sanity/pkg-utils": patch
"@sanity/tsdown-config": patch
---

Rename the vanilla-extract node/SSR CSS shim from `bundle.css.js` to `bundle-css.js`, and add an explicit `types` condition to the conditional `./bundle.css` export.

`bundle.css.js` matches vanilla-extract's `cssFileFilter` (`/\.css\.(js|…)$/`), so Vite plugins (notably `@sanity/vanilla-extract-vite-plugin` via Vite's `ModuleRunner`) would try to evaluate the empty shim as `.css.ts` output and throw. The public `./bundle.css` export subpath is unchanged; only the on-disk shim (and its `node`/`default` export targets) move to `bundle-css.js`, with matching `bundle-css.d.ts` / `bundle.css.d.ts` companions for both export targets.

Since the shim's basename no longer matches the CSS file's basename, TypeScript's extension-substitution fallback (stripping `.js` to find a sibling `.d.ts`) would now resolve a different file than before - and that fallback is being deprecated in TypeScript itself (microsoft/TypeScript#50762). The conditional export now points a `types` condition directly at the shim's declaration file instead of relying on it:

```json
"./bundle.css": {
  "types": "./dist/bundle-css.d.ts",
  "browser": "./dist/bundle.css",
  "style": "./dist/bundle.css",
  "node": "./dist/bundle-css.js",
  "default": "./dist/bundle-css.js"
}
```

Rebuilding a package with compat mode on rewrites `package.json` automatically.
