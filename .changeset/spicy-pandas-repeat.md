---
"@sanity/vanilla-extract-tsdown-plugin": minor
---

feat: initial release of `@sanity/vanilla-extract-tsdown-plugin`, a tsdown plugin for vanilla-extract that extracts CSS into a single `lightningcss`-optimized file, following the same architecture and option vocabulary (`fileName`, `minify`, `target`, `inject`) as `@tsdown/css`. Unlike `@vanilla-extract/rollup-plugin` it doesn't declare `rollup` as a peer dependency, and it declares plugin hook filters ([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)) so rolldown skips the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related
