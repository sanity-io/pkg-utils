---
'@sanity/pkg-utils': major
---

The `tsconfig` presets have moved to a new package, `pnpm install --save-dev @sanity/tsconfig` and update your imports in `tsconfig.json` files:

- `@sanity/pkg-utils/tsconfig/recommended.json` -> `@sanity/tsconfig/recommended`
  ```diff
  {
  -  "extends": "@sanity/pkg-utils/tsconfig/recommended.json"
  +  "extends": "@sanity/tsconfig/recommended"
  }
  ```
- `@sanity/pkg-utils/tsconfig/strict.json` -> `@sanity/tsconfig/strict`
  ```diff
  {
  -  "extends": "@sanity/pkg-utils/tsconfig/strict.json"
  +  "extends": "@sanity/tsconfig/strict"
  }
  ```
- `@sanity/pkg-utils/tsconfig/strictest.json` -> `@sanity/tsconfig/strictest`
  ```diff
  {
  -  "extends": "@sanity/pkg-utils/tsconfig/strictest.json"
  +  "extends": "@sanity/tsconfig/strictest"
  }
  ```
- `@sanity/pkg-utils/tsconfig/isolated-declarations.json` -> `@sanity/tsconfig/isolated-declarations`
  ```diff
  {
  -  "extends": ["@sanity/pkg-utils/tsconfig/strictest.json", "@sanity/pkg-utils/tsconfig/isolated-declarations.json"]
  +  "extends": ["@sanity/tsconfig/strictest", "@sanity/tsconfig/isolated-declarations"]
  }
  ```
