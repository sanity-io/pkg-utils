---
'@sanity/vanilla-extract-vite-plugin': patch
---

fix: extract CSS when the parent Vite config enables the `browser` resolve condition

The compiler server now strips `browser` from forwarded resolve conditions and mainFields
(`resolve`, `ssr.resolve`, and `environments.ssr.resolve`) when evaluating `.css.ts` modules,
while keeping the parent's other conditions. Without this, configs like `sanity build` could
resolve the browser build of `@vanilla-extract/css`, emit class names without rules, and drop
virtual `.vanilla.css` imports from production bundles.
