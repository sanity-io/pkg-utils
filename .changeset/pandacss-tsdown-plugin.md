---
'@sanity/pandacss-tsdown-plugin': minor
---

Add `@sanity/pandacss-tsdown-plugin`, a tsdown plugin that extracts the Panda CSS stylesheet of a library into a single lightningcss-optimized file. It complements `@pandacss/vite`: it shares its `cwd`, `configPath`, `outdir` and `transform` options, and the `fileName`, `minify`, `target`, `lightningcss`, `inject` and `exports` options of `@tsdown/css` and `@sanity/vanilla-extract-tsdown-plugin`.
