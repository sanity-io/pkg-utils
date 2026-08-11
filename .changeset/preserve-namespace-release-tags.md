---
'@sanity/tsdown-config': patch
---

Preserve an explicit TSDoc release tag on `export * as namespace` declarations when bundling types, so API Extractor no longer reports the generated `<module>_d_exports` namespace as untagged.
