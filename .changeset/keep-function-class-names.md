---
'@sanity/tsdown-config': minor
---

The default `minify` compress pass now preserves function and class names
(`compress: {keepNames: {function: true, class: true}}`, previously `compress: true`).

The compress pass otherwise strips otherwise-unreferenced names - most notably the inner name
in `forwardRef(function Button(…) {…})`, which React DevTools reads via `Function.name`. That
name is the tree-shakeable alternative to a top-level `Button.displayName = '…'` assignment (a
side effect that pins unused components into consumer bundles, see
[sanity-io/ui#2435](https://github.com/sanity-io/ui/pull/2435)), and once stripped at publish
time it is unrecoverable in userland. Keeping the names costs a fraction of a kilobyte in the
published dist and nothing in final app bundles - consumers' production builds minify
`node_modules` again anyway (and can opt into their own `keepNames`/`keep_fnames` for readable
production profiling, which only works if the library kept the names in the first place).

Packages that already apply this override on top of `defineConfig` (like `@sanity/ui`) can
remove it. To restore the previous behavior, merge over the returned config:

```ts
import {defineConfig} from '@sanity/tsdown-config'
import {mergeConfig} from 'tsdown'

export default mergeConfig(await defineConfig(), {minify: {compress: true}})
```
