---
'@sanity/tsdown-config': minor
---

Add `panda.cascadeLayers`, passed through to `@sanity/pandacss-tsdown-plugin`. It defaults to `true`, so the Panda stylesheet keeps its cascade layers, as before; `panda: {cascadeLayers: false}` publishes it without them, so consumers can override its base styles without overriding its states. Switching the default to `false` is planned for a later release of its own, once `@sanity/ui` and `sanity` have adopted the option.
