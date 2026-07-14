---
"@sanity/tsdown-config": minor
---

feat: forward tsdown's `exports` option with the Sanity defaults documented on `PackageOptions` (`enabled: 'local-only'` and `devExports: true`), applied with tsdown's `mergeConfig` semantics: an object deep-merges over the defaults, while any other value (`false`, a bare CI condition) replaces them. The `tsconfig` option no longer defaults to `'tsconfig.json'` and is forwarded as-is, since tsdown auto-detects the project tsconfig. Options that aren't exposed on `PackageOptions` can be customized by merging over the returned config with tsdown's `mergeConfig`, now documented in the README
