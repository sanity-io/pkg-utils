Shared config for tsdown

```sh
pnpm add --save-dev @sanity/tsdown-config tsdown
```

Create a `tsdown.config.ts` file with:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({tsconfig: 'tsconfig.dist.json'})
```

## styled-components

If your package uses `styled-components`, enable the same `styledComponents` transform that `@sanity/pkg-utils` has:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  styledComponents: true,
})
```

It adds `displayName` (better debugging) and `componentId` (avoids SSR hydration mismatches) to your styled components, and minifies the CSS in tagged template literals.
Unlike `@sanity/pkg-utils` it doesn't require installing `babel-plugin-styled-components`, as it uses [oxc's native port](https://oxc.rs/docs/guide/usage/transformer/plugins.html#styled-components) of the babel plugin.

Pass an object to customize the transform, using the same options as [`babel-plugin-styled-components`](https://styled-components.com/docs/tooling#babel-plugin):

```ts
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  styledComponents: {namespace: 'my-package'},
})
```
