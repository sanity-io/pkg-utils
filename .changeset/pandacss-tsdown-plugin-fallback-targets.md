---
'@sanity/pandacss-tsdown-plugin': minor
---

`target` accepts tsdown's `'baseline-widely-available'` alias, like `css.target` in `@tsdown/css`.

Hosts can pass `fallbackTargets` to `plugin.api.setBuildContext()`: Lightning CSS targets used when the effective `target` names no browsers, such as `node20`. An explicit `lightningcss.targets` still wins.
