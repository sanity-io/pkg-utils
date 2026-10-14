# @sanity/pandacss-tsdown-plugin

A [tsdown](https://tsdown.dev) plugin that extracts the [Panda CSS](https://panda-css.com)
stylesheet of a library into a single [lightningcss](https://lightningcss.dev)-optimized file,
modeled after [`@tsdown/css`](https://tsdown.dev/options/css).

It complements [`@pandacss/vite`](https://panda-css.com/docs/installation/vite), which covers
Vite-based tooling (Vitest, `sanity dev`, `sanity build`) in the same project: this plugin covers
the tsdown builds that publish the package.

```sh
pnpm add -D @sanity/pandacss-tsdown-plugin
```

```ts
// tsdown.config.ts
import {pandaPlugin} from '@sanity/pandacss-tsdown-plugin'
import {defineConfig} from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  exports: true,
  plugins: [pandaPlugin({exports: {nodeCompat: true}})],
})
```

With [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme),
enable it through the `panda` option instead, which also resolves browserless lowering targets
from `@sanity/browserslist-config`:

```ts
// tsdown.config.ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  panda: {exports: {nodeCompat: true}},
})
```

The plugin loads `panda.config.*` with `@pandacss/compiler`, parses the files matched by its
`include`/`exclude` globs, and emits every cascade layer (`reset`, `base`, `tokens`, `recipes` and
`utilities`) without the layer order declaration. Panda's `--made-with-panda` marker is always
removed. The plugin never runs codegen: run `panda codegen` (or `@pandacss/vite`) when the source
imports the generated `styled-system` directory, or enable `transform` to compile the style calls
away.

## Options

| Option         | Default           | Description                                                                                                                                                                   |
| -------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd`          | tsdown's `cwd`    | Where the Panda config is discovered from, and what its globs are relative to.                                                                                                |
| `configPath`   |                   | An explicit Panda config file, relative to `cwd`.                                                                                                                             |
| `outdir`       | the config's      | The generated `styled-system` directory, which is never parsed or transformed.                                                                                                |
| `transform`    | `false`           | Statically transform style calls into class name strings, like `@pandacss/vite`.                                                                                              |
| `fileName`     | `"styles.css"`    | Name of the emitted stylesheet.                                                                                                                                               |
| `minify`       | `false`           | Minify the stylesheet.                                                                                                                                                        |
| `target`       | tsdown's `target` | esbuild-style targets for syntax lowering, or `false` to disable it. Browserless targets skip lowering.                                                                       |
| `lightningcss` |                   | Options passed to lightningcss's `transform()`. `targets` wins over `target`, and `unusedSymbols` is merged with `--made-with-panda`.                                         |
| `inject`       | `false`           | Import the stylesheet from every entry chunk that uses Panda styles (`require()` in CJS).                                                                                     |
| `exports`      | `false`           | Publish the stylesheet as the `"./<fileName>"` export subpath. `{nodeCompat: true}` declares a conditional export backed by a no-op JS shim for runtimes without CSS support. |

## License

MIT
