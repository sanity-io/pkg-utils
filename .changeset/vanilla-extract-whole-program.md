---
'@sanity/vanilla-extract-integration': minor
'@sanity/vanilla-extract-rolldown-plugin': minor
'@sanity/vanilla-extract-tsdown-plugin': minor
'@sanity/vanilla-extract-vite-plugin': minor
---

Add whole-program compilation (`compilation: 'whole-program'`, with `roots`): every `.css.ts` module of a project is compiled, evaluated and rendered once — one child compilation and one stylesheet instead of one per module — with class names and exports identical to per-module compilation. Modules render in dependency order, then discovery order, with every conditional block after every unconditional rule, so `vite dev` and the library build agree on the cascade and a later module's base rule no longer beats an earlier module's media rule. `@sanity/vanilla-extract-integration` gains `compileProgram()`, `processVanillaProgram()`, `evaluateVanillaModule()`, `discoverCssModules()` and a vendored `transformCss` with byte-identical output.
