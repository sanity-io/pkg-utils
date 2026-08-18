---
'@sanity/tsdown-config': minor
'@sanity/pkg-utils': minor
---

Add a `bundleAnalyzer` option that wires Rolldown's experimental markdown bundle analyzer.

`true` selects `format: 'md'` (an LLM-friendly `analyze-data.md` in `outDir`) rather than the plugin's own JSON default, so an env-gated opt-in is enough:

```ts
bundleAnalyzer: process.env.ENABLE_BUNDLE_ANALYZER === 'true'
```

Pass an object to customize `format` / `fileName`. The report is not a publishable artifact — exclude it from `package.json` `files` (e.g. `"!dist/analyze-data.md"`). `@sanity/pkg-utils` forwards the same option from `package.config.ts`.
