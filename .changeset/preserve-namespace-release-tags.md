---
'@sanity/tsdown-config': patch
---

Preserve an explicit TSDoc release tag on namespace re-exports when bundling types, so API Extractor no longer reports the generated `<module>_d_exports` namespace as untagged.
