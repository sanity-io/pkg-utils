---
'@sanity/vanilla-extract-integration': minor
'@sanity/vanilla-extract-rolldown-plugin': minor
'@sanity/vanilla-extract-tsdown-plugin': minor
'@sanity/vanilla-extract-vite-plugin': minor
---

Add the atomic pass (`atomic: true | {report: true}`): the declarations of `style()` rules are rendered as shared single-declaration classes and the exported class lists are expanded with them, identity class first — the same classlist shape as vanilla-extract's own style composition. Two identical declarations share a class only when no declaration whose property overlaps theirs is rendered between them in the same cascade layer with the same importance, which is exactly the condition under which every combination of classes on an element keeps resolving to the same winner. Complex selectors, `globalStyle` and themes stay as they are. The property overlap table is generated from `mdn-data` and cross-checked against StyleX's resolution tables.
