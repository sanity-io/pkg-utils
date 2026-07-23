---
'@sanity/tsdown-config': minor
---

Add `reactServer` to the `reactCompiler` options, for libraries that render in React Server Components. It's experimental (`@alpha`) and not covered by semver: it can change behavior or be removed entirely in a minor version.

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  reactCompiler: {target: '19', reactServer: true},
})
```

React Server Components refuse to load React Compiler output (`react/compiler-runtime` throws in the `react-server` environment), so libraries that ship compiled code are expected to [publish two entrypoints](https://github.com/facebook/react/issues/31702). `reactServer: true` bakes that pattern in: every entry is built twice from the same source, and the only difference is that React Compiler auto-memoization is applied to the non-`react-server` output. The uncompiled build lands next to the compiled one (`dist/index.js` ↔ `dist/index.react-server.js`), and when the `exports` feature is enabled every entry export gains a `react-server` condition:

```json
{
  "exports": {
    ".": {
      "react-server": "./dist/index.react-server.js",
      "default": "./dist/index.js"
    }
  }
}
```

Nothing is stripped from either output, so pair it with deleting manual `useMemo`/`useCallback` calls from the source: server components stop paying for memoization that cannot pay off (they render exactly once), and client components get the compiler's finer-grained auto-memoization instead.
