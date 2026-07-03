---
"@sanity/tsdown-config": minor
---

Add `reactCompiler` option, the same feature as `babel: {reactCompiler: true}` in `@sanity/pkg-utils`.

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  reactCompiler: true,
})
```

It runs `babel-plugin-react-compiler` on the source files before they are bundled, so published components are memoized automatically. Pass an object instead of `true` to configure the compiler with the same options as `babel-plugin-react-compiler` (e.g. `reactCompiler: {target: '18'}`). Requires `babel-plugin-react-compiler` to be installed.
