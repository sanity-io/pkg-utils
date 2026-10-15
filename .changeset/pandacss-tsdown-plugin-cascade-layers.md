---
'@sanity/pandacss-tsdown-plugin': minor
---

Add a `cascadeLayers` option, which defaults to `true`: the stylesheet keeps Panda's cascade layers, as before. Set `cascadeLayers: false` to publish the stylesheet without any `@layer` blocks or statements, so consumers can override its base styles with plain CSS or `styled()` without also overriding its `:hover`, `:focus-visible` and other states, which unlayered consumer CSS beats in a layered stylesheet. The rules are ordered so that source order gives them the precedence Panda's layers gave them, and every selector keeps its specificity, unlike with Panda's `polyfill`, which raises it. The layers are removed last, from the CSS Lightning CSS printed, by moving the rules out of their `@layer` blocks in a PostCSS tree: Lightning CSS and any `lightningcss.visitor` see Panda's layered output, and every rule keeps the text Lightning CSS gave it. See the README for the trade-offs.

The plugin now rejects an option it doesn't have instead of ignoring it, so an option of a newer `@sanity/tsdown-config` than the installed plugin is reported, and exports `PANDACSS_PLUGIN_OPTION_NAMES`, the names of its options, for hosts that pass options through.
