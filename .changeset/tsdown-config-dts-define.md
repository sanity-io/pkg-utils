---
"@sanity/tsdown-config": minor
---

Add `dts` and `define` options, passed through to `tsdown` as-is.

The `dts` option customizes how `.d.ts` files are generated, for example to use `tsgo` for type generation (the same feature as the `tsgo` option in `@sanity/pkg-utils`, requires `@typescript/native-preview` to be installed):

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: {tsgo: true},
})
```

The `define` option replaces global identifiers with constant expressions at build time (the same feature as the `define` option in `@sanity/pkg-utils`):

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  define: {'process.env.NODE_ENV': JSON.stringify('production')},
})
```
