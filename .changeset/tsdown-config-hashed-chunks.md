---
"@sanity/tsdown-config": minor
---

Rely on tsdown's default hashed chunk filenames (`[name]-[hash].<ext>`) instead of setting `hash: false` and emitting shared chunks into `_chunks-es`, `_chunks-cjs` and `_chunks-dts` folders.

The hash suffix keeps a shared (non-entry) chunk from ever taking an entry's filename, which is what the `_chunks-*` folders were guarding against: code shared between two entries forms a chunk that rolldown may name after one of the entries (e.g. `theme`), and without the hash the d.ts output could hand the entry's `theme.d.ts` filename to the chunk - which exports everything under minified aliases - breaking every named import from that entry with `TS2460` (see [sanity-io/ui#2262](https://github.com/sanity-io/ui/issues/2262)). Entries keep their stable, unhashed filenames, so public import paths are unaffected; only the internal chunk filenames change (e.g. `_chunks-es/theme.js` becomes `theme-CYP9-xTb.js`).

`PackageOptions` now also exposes tsdown's `hash` option, forwarded as-is, so userland can still opt out of the hashing (at the risk of reintroducing the filename collision on multi-entry packages, unless `outputOptions.chunkFileNames` keeps chunks away from the entries).
