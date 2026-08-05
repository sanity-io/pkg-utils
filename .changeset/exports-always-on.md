---
'@sanity/tsdown-config': minor
'@sanity/pkg-utils': patch
---

Default `exports.enabled` to `true` instead of `'local-only'`.

Gating on `CI` via `'local-only'`/`'ci-only'` surprised environments that set `CI=true` without meaning "don't rewrite package.json" (notably Cursor Cloud and GitHub Copilot)
