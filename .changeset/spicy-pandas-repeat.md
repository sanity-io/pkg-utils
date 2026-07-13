---
"@sanity/vanilla-extract-rolldown-plugin": minor
---

feat: initial release of `@sanity/vanilla-extract-rolldown-plugin`, a rolldown-native port of `@vanilla-extract/rollup-plugin` that extracts, optimizes and minifies CSS with `lightningcss`. Unlike the rollup plugin it doesn't declare `rollup` as a peer dependency, and it declares plugin hook filters ([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)) so rolldown skips the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related
