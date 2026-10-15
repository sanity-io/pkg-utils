---
'@sanity/tsdown-config': minor
---

Add `panda.cascadeLayers`, passed through to `@sanity/pandacss-tsdown-plugin`: `panda: {cascadeLayers: false}` publishes the Panda stylesheet without cascade layers, so consumers can override its base styles without overriding its states. Layers stay on by default.
