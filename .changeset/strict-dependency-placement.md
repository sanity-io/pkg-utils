---
'@sanity/pkg-utils': minor
---

Add strict dependency placement checks for well-known packages. When running with `--strict`, `package.json` is now validated to ensure these packages are declared in the correct dependency fields:

- `react-is` and `@sanity/ui` should not be in `peerDependencies` (use `dependencies` or `devDependencies`).
- `sanity`, `styled-components`, `react`, and `react-dom` should not be in `dependencies` (use `devDependencies` and/or `peerDependencies`).
- `@types/react`, `@types/react-dom`, and `@types/node` should not be in `dependencies` (use `devDependencies` and/or `peerDependencies`), and when listed in `peerDependencies` the version range should be `*`.
- `rxjs` and `@sanity/client` should not be in `peerDependencies` (use `dependencies` or `devDependencies`).

Each check is enabled by default at the `warn` level and can be promoted to `error` or disabled via `strictOptions` in `package.config.ts`, e.g.:

```ts
import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  strictOptions: {
    noReactDependency: 'error',
    noSanityClientPeerDependency: 'off',
  },
})
```
