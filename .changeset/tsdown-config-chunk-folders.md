---
"@sanity/tsdown-config": minor
---

Emit shared (non-entry) chunks into `_chunks-es`, `_chunks-cjs` and `_chunks-dts` folders, following the same naming convention as `@sanity/pkg-utils`, instead of placing them at the root of `dist` next to the entries.

A chunk could otherwise take an entry's filename: code shared between two entries forms a chunk that rolldown may name after one of the entries (e.g. `theme`). The JS output deduplicates such filename collisions in favor of the entry, but the d.ts output could resolve them the other way around, handing the entry's `.d.ts` filename to the chunk - which exports everything under minified aliases like `buildTheme as x` - so every named import from that entry failed to type-check with `TS2460` (see [sanity-io/ui#2262](https://github.com/sanity-io/ui/issues/2262)). With chunks emitted into their own folders they can never collide with entry filenames.
