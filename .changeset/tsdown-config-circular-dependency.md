---
"@sanity/tsdown-config": minor
---

Enable Rolldown's `checks.circularDependency` warning by default (Rolldown itself defaults it to `false`), so import cycles surface during Sanity library builds. Override with `mergeConfig(..., {checks: {circularDependency: false}})` if needed.
