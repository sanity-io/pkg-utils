---
"@sanity/pkg-utils": minor
---

feat: Add configurable strict checks for legacy package.json fields

Added new strict options to warn about deprecated package.json fields that are no longer needed with modern Node.js and bundlers:

- `noPackageJsonMain` - Warns when `main` field is present (use `exports` instead)
- `noPackageJsonModule` - Warns when `module` field is present (use `exports` instead)
- `noPackageJsonBrowser` - Warns when `browser` field is present (use `browser` condition in `exports`)
- `noPackageJsonTypesVersions` - Warns when `typesVersions` field is present (TypeScript supports `types` condition in `exports`)
- `preferModuleType` - Warns when `type` field is missing or set to `commonjs` (future versions will require `"type": "module"`)

All new checks default to `warn` level and are configurable via `strictOptions` in `package.config.ts`.

**BREAKING CHANGES**: 
- Removed `alwaysPackageJsonMain` strict option (conflicted with the new `noPackageJsonMain` option)
- The top-level `types` field is still required for npm package listings to show TypeScript support

