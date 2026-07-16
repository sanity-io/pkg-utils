---
'@sanity/vanilla-extract-vite-plugin': patch
'@sanity/vanilla-extract-integration': patch
---

fix: keep Node resolution when evaluating `.css.ts` (Studio build / schema extract)

`@sanity/vanilla-extract-vite-plugin`: the compiler server strips `browser` from forwarded
resolve conditions/mainFields (`resolve`, `ssr.resolve`, `environments.ssr.resolve`) and never
forwards parent `ssr.noExternal: true`. Vite's `ModuleRunner` cannot evaluate inlined CJS
(unlike upstream's `vite-node` + `noExternal: true`), which caused `module is not defined`
during `sanity schema extract` / TypeGen; inheriting `browser` conditions dropped extracted
CSS in `sanity build`.

`@sanity/vanilla-extract-integration`: pin rolldown `resolve.mainFields` / `aliasFields` to the
`platform: 'node'` defaults (no `browser` mainField or package.json `browser` remapping) so
dual-shipped packages keep resolving the Node build after the esbuild → rolldown swap.
