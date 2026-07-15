---
'@sanity/tsdown-config': minor
---

Expose tsdown's `sourcemap` and `deps` options on `PackageOptions`, default `sourcemap` to `true` (matching `@sanity/pkg-utils`), and when `platform` is `'neutral'` mark `node:` built-ins external and restore `module`/`main` resolve fallbacks so monorepo wrappers no longer need `mergeConfig` for those
