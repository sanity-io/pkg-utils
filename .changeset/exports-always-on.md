---
'@sanity/tsdown-config': minor
'@sanity/pkg-utils': patch
---

Default `exports` generation to always-on (`true`) instead of `enabled: 'local-only'`.

Gating on `CI` via `'local-only'`/`'ci-only'` surprised environments that set `CI=true` without meaning "don't rewrite package.json" (notably Cursor Cloud). Exports generation now runs the same everywhere; pnpm projects still get `devExports: true` by default. Opt back into a CI condition with `exports: {enabled: 'local-only'}` (or `'ci-only'`) if you need the old gate.
