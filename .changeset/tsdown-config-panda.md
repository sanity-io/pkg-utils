---
'@sanity/tsdown-config': minor
---

Add the `panda` option, which enables `@sanity/pandacss-tsdown-plugin` (an optional peer dependency, like `@sanity/vanilla-extract-tsdown-plugin` for `vanillaExtract`) to rewrite the Panda CSS style calls of the package into static class names and extract the generated stylesheet into `dist/bundle.css`, with the same defaults as `vanillaExtract`: `inject: true` with `exports: {nodeCompat: true}` wires up the conditional CSS export pattern, the CSS is lowered with `lightningcss` for the effective `target` (falling back to `@sanity/browserslist-config` for browserless targets), and `minify` stays opt-in.
