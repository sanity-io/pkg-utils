---
'@sanity/tsdown-config': minor
'@sanity/pkg-utils': patch
---

Default `exports.enabled` to `true` instead of `'local-only'`.

Gating on `CI` via `'local-only'`/`'ci-only'` surprised environments that set `CI=true` without meaning "don't rewrite package.json" (notably Cursor Cloud). The defaults stay object-shaped (`{enabled: true, …}` / `{enabled: true}`), so mergeConfig behavior is unchanged aside from the always-on `enabled` value. Opt back into a CI condition with `exports: {enabled: 'local-only'}` (or `'ci-only'`) if you need the old gate.
