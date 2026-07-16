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

`@sanity/vanilla-extract-integration`: pin rolldown `resolve` to esbuild's `platform: 'node'`
defaults (`mainFields: ['main', 'module']`, `conditionNames: ['module']`, no `browser` alias
fields) so dual-shipped packages resolve the same way as before the esbuild → rolldown swap.
