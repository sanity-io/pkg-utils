Shared config for tsdown

```sh
pnpm add --save-dev @sanity/tsdown-config tsdown
```

Create a `tsdown.config.ts` file with:
```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({tsconfig: 'tsconfig.dist.json'})
```
