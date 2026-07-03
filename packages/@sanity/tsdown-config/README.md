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

## vanilla-extract

The same `vanillaExtract` feature as `@sanity/pkg-utils` is available. It extracts the CSS from
`.css.ts` files into a separate, `lightningcss`-optimized file (`dist/bundle.css` by default).
Start by installing `@vanilla-extract/css` for authoring the `.css.ts` files:

```sh
pnpm add --save-dev @vanilla-extract/css
```

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  vanillaExtract: true,
})
```

By default a compatibility mode is active that automatically wires up the conditional CSS export
pattern:

- injects the self-referential `import "<pkg>/bundle.css"` into the `index` entry chunk,
- emits a no-op `bundle.css.js` shim (plus `bundle.css.d.ts`) for runtimes that cannot import
  `.css` files, and
- writes the conditional `"./bundle.css"` export to `package.json` (`browser`/`style` → the real
  CSS, `node`/`default` → the shim).

The result is that `import "<pkg>/bundle.css"` resolves to the real CSS in bundlers/browsers and to
the no-op shim in Node and similar runtimes. Make sure the extracted CSS survives tree-shaking in
consumers by adding it to `sideEffects` in `package.json`:

```json
{
  "sideEffects": ["*.css"]
}
```

Pass an options object instead of `true` to customize (e.g. `minify`, `browserslist`,
`extract.name`), or set `extract.compatMode: false` to wire up the import, shim, and export
yourself.
