---
'@sanity/tsdown-config': minor
---

Upgrade tsdown peer dependency from `0.20.x` to `0.21.x`.

Notable changes in tsdown v0.21.0:
- Dependency options have been renamed to a `deps` namespace: `external` → `deps.neverBundle`, `noExternal` → `deps.alwaysBundle`, `inlineOnly` → `deps.onlyAllowBundle`, `skipNodeModulesBundle` → `deps.skipNodeModulesBundle`. The old options are deprecated and will emit warnings.
- The `failOnWarn` default changed from `'ci-only'` to `false`. Set `failOnWarn: 'ci-only'` explicitly if you want warnings to fail the build in CI.
