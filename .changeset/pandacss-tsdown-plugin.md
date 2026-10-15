---
'@sanity/pandacss-tsdown-plugin': minor
---

Add `@sanity/pandacss-tsdown-plugin`, a tsdown plugin that extracts the Panda CSS stylesheet of a library into a single lightningcss-optimized file. It runs Panda's codegen before extracting, so the generated `styled-system` code and types always match the config, rewriting only the files that changed. It complements `@pandacss/vite`: it shares its `cwd`, `configPath`, `outdir` and `transform` options, and the `fileName`, `minify`, `target`, `lightningcss`, `inject` and `exports` options of `@tsdown/css` and `@sanity/vanilla-extract-tsdown-plugin`. Unlike `@pandacss/vite`, `transform` is enabled by default, statically compiling the style calls into class name strings; set `transform: false` to keep them as written. Like `@pandacss/vite`, it depends on Panda's compiler and transformer directly, with `tsdown` as its only peer dependency.
