---
"@sanity/pkg-utils": minor
---

feat: Rename strict options to use `PackageJson` prefix instead of `RootLevel`

Renamed the following strict options for better clarity:
- `noRootLevelMain` → `noPackageJsonMain`
- `noRootLevelModule` → `noPackageJsonModule`
- `noRootLevelBrowser` → `noPackageJsonBrowser`
- `noRootLevelTypesVersions` → `noPackageJsonTypesVersions`

**BREAKING CHANGE**: If you were using the old option names in your `package.config.ts`, you need to update them to the new names.
