---
'@sanity/tsdown-config': minor
---

Add `styledComponents` option, the same feature as `babel: {styledComponents: true}` in `@sanity/pkg-utils`.

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  styledComponents: true,
})
```

It applies the `styled-components` transform (adding `displayName` for better debugging, `componentId` to avoid SSR hydration mismatches, and minifying the CSS in tagged template literals) with the same defaults as `@sanity/pkg-utils`, and tree-shakes unused styled components from the output (via `treeshake.manualPureFunctions`, as pure annotations on tagged template expressions aren't supported by bundlers). Unlike `@sanity/pkg-utils` it doesn't require installing `babel-plugin-styled-components`, as it uses oxc's native port of the babel plugin. Pass an object instead of `true` to customize the transform with the same options as `babel-plugin-styled-components`.
