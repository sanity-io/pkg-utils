# @sanity/pandacss-tsdown-plugin

Panda CSS plugin for [`tsdown`](https://tsdown.dev) — the library-build counterpart to `@pandacss/vite`.

## Features

- Loads `panda.config.*` with `@pandacss/compiler` (`createNodeDriver`) and derives `transform.filter.id` from its `include`/`exclude` globs (skipping `transform.filter.id` scoping when neither is defined).
- Runs Panda codegen (`driver.codegen()`) automatically at build start and again when `panda.config.*` (or its imported files) reloads in watch mode, keeping `styled-system/` types and class names current while leaving unchanged files untouched.
- Rewrites `css({...})` calls at build time into atomic class names via `@pandacss/transformer` by default (`transform: true`, unlike `@pandacss/vite` which defaults to `false`; set `transform: false` to opt out).
- Extracts all Panda CSS layers (`reset`, `base`, `tokens`, `recipes`, `utilities`) with `emitLayerDeclaration: false`, lowers syntax and removes `--made-with-panda` with `lightningcss`, and emits `styles.css`.
- Supports `inject`, `exports.nodeCompat` (emitting `styles-css.js` and `styles-css.d.ts` Node shims and wiring conditional `package.json#exports`), `target`, and `minify`.

## Installation

```sh
pnpm add -D tsdown @sanity/tsdown-config @sanity/pandacss-tsdown-plugin
```

`@pandacss/compiler` and `@pandacss/transformer` are direct dependencies of `@sanity/pandacss-tsdown-plugin`, so only `tsdown`, `@sanity/tsdown-config`, and `@sanity/pandacss-tsdown-plugin` are required for building.

Installing `@pandacss/dev` (an optional peer dependency) is recommended: it provides a `"prepare": "panda codegen"` script so `styled-system/` types exist for your IDE and TypeScript before a build runs, `defineConfig` and `Config` for authoring `panda.config.ts`, and helpful CLI commands for debugging (such as validating `panda.config.ts`).

```sh
pnpm add -D @pandacss/dev
```

```ts
// panda.config.ts
import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  include: ['./src/**/*.{ts,tsx}'],
  importMap: '#styled-system',
  preflight: false,
} satisfies Config)
```

## Usage

### With `@sanity/tsdown-config`

```ts
// tsdown.config.ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  panda: true,
})
```

### Standalone with `tsdown`

```ts
// tsdown.config.ts
import {pandaCssPlugin} from '@sanity/pandacss-tsdown-plugin'
import {defineConfig} from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  plugins: [
    pandaCssPlugin({
      inject: true,
      exports: {nodeCompat: true},
    }),
  ],
})
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `cwd` | `string` | tsdown's `cwd` | Working directory used to discover `panda.config.*` and resolve `include`/`exclude` globs. |
| `configPath` | `string` | discovered upward | Explicit path to the Panda config file. |
| `codegen` | `boolean` | `true` | Run `driver.codegen()` at build start and on watch-mode config reloads. |
| `outdir` | `string` | config's `outdir` | Override the generated `styled-system` directory path. |
| `transform` | `boolean` | `true` | Rewrite `css({...})` calls into static class names at build time via `@pandacss/transformer` (unlike `@pandacss/vite`, which defaults `transform` to `false`; set `false` to opt out). |
| `fileName` | `string` | `'styles.css'` | Emitted CSS asset filename. |
| `inject` | `boolean \| {nodeCompat?: boolean}` | `false` | Prepend a CSS side-effect import to entry chunks that use Panda styles. |
| `exports` | `boolean \| CssExportsOptions` | `false` | Register `./<fileName>` in `package.json#exports` via `customExports` and emit Node-compat shims when `nodeCompat: true`. |
| `minify` | `boolean` | `false` | Minify the emitted CSS with LightningCSS. |
| `target` | `string \| string[] \| false` | tsdown's `target` | Browser targets for LightningCSS syntax lowering (`false` disables lowering). |
| `lightningcss` | `LightningCSSOptions` | `undefined` | Additional options forwarded to `lightningcss.transform()`. |

## License

MIT © [Sanity.io](https://www.sanity.io/)
