Shared config for tsdown

```sh
pnpm add --save-dev @sanity/tsdown-config tsdown
```

Create a `tsdown.config.ts` file with:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({tsconfig: 'tsconfig.dist.json'})
```

## React Compiler

The same `babel.reactCompiler` feature as `@sanity/pkg-utils` is available. It runs
[`babel-plugin-react-compiler`](https://react.dev/learn/react-compiler) on the source files before
they are bundled, so published components are memoized automatically. The plugin needs to be
installed separately:

```sh
pnpm add --save-dev babel-plugin-react-compiler
```

Then enable it, and optionally configure the compiler with `reactCompilerOptions`:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  babel: {reactCompiler: true},
  reactCompilerOptions: {target: '19'},
})
```
