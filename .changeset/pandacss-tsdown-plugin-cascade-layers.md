---
'@sanity/pandacss-tsdown-plugin': minor
---

Add a `cascadeLayers` option. Set `cascadeLayers: false` to publish the stylesheet without any `@layer` blocks or statements, so consumers can override its base styles with plain CSS or `styled()` without also overriding its `:hover`, `:focus-visible` and other states, which unlayered consumer CSS beats in a layered stylesheet. The rules are ordered so that source order gives them the precedence Panda's layers gave them, and every selector keeps its specificity, unlike with Panda's `polyfill`, which raises it. The option defaults to `true`, keeping the layers; see the README for the trade-offs.
