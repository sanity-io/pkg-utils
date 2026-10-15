# @sanity/pandacss-tsdown-plugin

A [tsdown](https://tsdown.dev) plugin that extracts the [Panda CSS](https://panda-css.com)
stylesheet of a library into a single [lightningcss](https://lightningcss.dev)-optimized file,
modeled after [`@tsdown/css`](https://tsdown.dev/options/css).

It complements [`@pandacss/vite`](https://panda-css.com/docs/installation/vite), which covers
Vite-based tooling (Vitest, `sanity dev`, `sanity build`) in the same project: this plugin covers
the tsdown builds that publish the package.

## Install

```sh
pnpm add -D tsdown @sanity/tsdown-config @sanity/pandacss-tsdown-plugin
```

That's all a build needs: the plugin depends on Panda's compiler and transformer directly, like
`@pandacss/vite`, and runs codegen itself.

[`@pandacss/dev`](https://www.npmjs.com/package/@pandacss/dev) is recommended, but not required:

- A `"prepare": "panda codegen"` script generates the `styled-system` directory for the IDE and
  TypeScript, before the first build.
- Its CLI helps debugging, e.g. `panda doctor` validates `panda.config.ts` and prints a project
  summary.

It's an optional peer dependency (`*`) of the plugin, so a project that installs it never ends up
with two copies of `@pandacss/dev` in `node_modules`:

```sh
pnpm add -D @pandacss/dev
```

## Usage

Enable it with the `panda` option of
[`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme),
which also resolves browserless lowering targets from `@sanity/browserslist-config`:

```ts
// tsdown.config.ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  panda: {exports: {nodeCompat: true}},
})
```

Or add the plugin to a plain tsdown config:

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

The plugin loads `panda.config.*` with `@pandacss/compiler`, parses the files matched by its
`include`/`exclude` globs, and emits every cascade layer (`reset`, `base`, `tokens`, `recipes` and
`utilities`) without the layer order declaration. Panda's `--made-with-panda` marker is always
removed.

## Codegen

Before anything is extracted, the plugin runs Panda's codegen into the `styled-system` directory
(the config's `outdir`), so the generated runtime, types and class names always match the config
the stylesheet is built from. Builds don't need a `prepare: "panda codegen"` script (it's still
recommended for the IDE, see [Install](#install)), and stale generated code can't leak into the
published JS or `.d.ts` files:

- Codegen finishes before any plugin's `buildStart` hook, so tsdown's declaration build reads the
  fresh types.
- Only files whose content changed are rewritten, and nothing is logged when nothing changed.
  Otherwise the build logs how many files were generated.
- In watch mode, changing the config or a file it imports reloads the config and runs codegen
  again before the rebuild.

Keep the generated directory out of git, like with `panda codegen`.

## Transform

`transform` statically compiles the `css()`, `cva()`, `sva()`, pattern and JSX style calls into
class name strings, so the published JS doesn't import the generated runtime. Unlike in
`@pandacss/vite`, where it defaults to `false`, it is **enabled by default**. Set
`transform: false` to keep the style calls (and their `styled-system` imports) as written; the
stylesheet is extracted either way.

## Watch mode

- Every file the config's `include` globs match is watched, and so are their base directories,
  so editing or adding a file that no entry imports still rebuilds the stylesheet.
- The build output and the generated directory are excluded from the watcher, so writing them
  never triggers another rebuild.
- Changing the config or a file it imports reloads the config and runs codegen again before the
  rebuild. Builds that share the plugin, like tsdown's builds per output format, wait for the
  reload before parsing or transforming anything.

## Options

| Option         | Default           | Description                                                                                                                                                                   |
| -------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd`          | tsdown's `cwd`    | Where the Panda config is discovered from, and what its globs are relative to.                                                                                                |
| `configPath`   |                   | An explicit Panda config file, relative to `cwd`.                                                                                                                             |
| `outdir`       | the config's      | The `styled-system` directory codegen writes to, which is never parsed or transformed.                                                                                        |
| `transform`    | `true`            | Statically transform style calls into class name strings, like `@pandacss/vite`, where it defaults to `false`. `transform: false` opts out.                                   |
| `fileName`     | `"styles.css"`    | Name of the emitted stylesheet.                                                                                                                                               |
| `minify`       | `false`           | Minify the stylesheet.                                                                                                                                                        |
| `target`       | tsdown's `target` | esbuild-style targets for syntax lowering, or `false` to disable it. Browserless targets skip lowering.                                                                       |
| `lightningcss` |                   | Options passed to lightningcss's `transform()`. `targets` wins over `target`, and `unusedSymbols` is merged with `--made-with-panda`.                                         |
| `inject`       | `false`           | Import the stylesheet from every entry chunk that uses Panda styles (`require()` in CJS).                                                                                     |
| `exports`      | `false`           | Publish the stylesheet as the `"./<fileName>"` export subpath. `{nodeCompat: true}` declares a conditional export backed by a no-op JS shim for runtimes without CSS support. |

## License

MIT
