Shared config for tsdown

```sh
pnpm add --save-dev @sanity/tsdown-config tsdown
```

Create a `tsdown.config.ts` file with:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({tsconfig: 'tsconfig.dist.json'})
```

## vanilla-extract

The same `vanillaExtract` feature as `@sanity/pkg-utils` is available. It enables
[`@vanilla-extract/rollup-plugin`](https://vanilla-extract.style/documentation/integrations/rollup/)
to extract the CSS from `.css.ts` files into a separate, `lightningcss`-optimized file
(`dist/bundle.css` by default). The plugin is an optional peer dependency and is only loaded when
the option is enabled, so start by installing it (along with `@vanilla-extract/css` for authoring
the `.css.ts` files):

```sh
pnpm add --save-dev @vanilla-extract/rollup-plugin @vanilla-extract/css
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
