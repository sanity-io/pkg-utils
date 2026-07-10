---
'@sanity/pkg-utils': major
---

feat: remove the deprecated `legacyExports` and `extract.rules['ae-forgotten-export']` config options

**BREAKING**: the `legacyExports` and `extract.rules['ae-forgotten-export']` properties are removed from `PkgConfigOptions`. Both stopped doing anything in v7.0.0 and have since been typed `never` with an `@deprecated` notice, so any config that still type-checked cannot be affected — only the tombstone properties themselves are gone. If your `package.config.ts` still mentions them, simply delete those lines:

- `legacyExports` — dual `commonjs`/`esm` packages are expressed through `exports` conditions instead.
- `extract.rules['ae-forgotten-export']` — obsolete since TypeScript 5.5, the rule is always off ([microsoft/TypeScript#42873](https://github.com/microsoft/TypeScript/issues/42873)).
