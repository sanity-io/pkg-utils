---
'@sanity/vanilla-extract-integration': minor
'@sanity/vanilla-extract-rolldown-plugin': minor
'@sanity/vanilla-extract-vite-plugin': minor
---

Vendor `@vanilla-extract/integration` onto the rolldown toolchain as `@sanity/vanilla-extract-integration`, and consume it from both plugins. The `compile()` child compilation of `.css.ts` graphs now runs on rolldown instead of esbuild (making library builds with the rolldown/tsdown plugin ~1.5x faster on the benchmark suite), debug IDs are injected by an offset-splicing AST pass over `rolldown/parseAst`'s oxc AST instead of `@vanilla-extract/babel-plugin-debug-ids` (picked over `yuku-parser` in a reproducible corpus bench-off), and the `eval`, `find-up`, `dedent`, and `mlly` dependencies are replaced with `node:vm` and inlined equivalents — dropping `@babel/core`, `esbuild`, and their subtrees from the plugins' production dependency graphs entirely.
