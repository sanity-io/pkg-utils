# @sanity/pandacss-tsdown-plugin

A [`tsdown`](https://tsdown.dev) plugin for publishing [Panda CSS](https://panda-css.com) libraries with a separate, pre-extracted stylesheet.

This plugin is designed for library builds in `tsdown.config.ts`: it runs Panda codegen, rewrites statically resolvable style calls into class names, and emits a single `styles.css` asset alongside your compiled JavaScript. Applications and dev servers (`vite.config.ts`, `vitest.config.ts`, `sanity.cli.ts`) can continue using `@pandacss/vite`.

## Installation

Only `tsdown`, `@sanity/tsdown-config` (when using the shared config), and `@sanity/pandacss-tsdown-plugin` are required. `@pandacss/transformer` and `@pandacss/compiler` are direct dependencies of this plugin, so you do not need to install them separately:

```sh
pnpm add -D tsdown @sanity/tsdown-config @sanity/pandacss-tsdown-plugin
```

`@pandacss/dev` is declared as an optional peer dependency (`*`). Installing it is recommended, though not required: it gives you a `"prepare": "panda codegen"` script so generated types exist for your IDE, typecheck, and test runner before a build runs, `defineConfig` and `Config` for authoring `panda.config.ts`, and CLI commands for debugging (such as validating `panda.config.ts`):

```sh
pnpm add -D @pandacss/dev
```

## Quick start

1. Configure `panda.config.ts` with `satisfies Config`:

```ts
// panda.config.ts
import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  include: ['./src/**/*.{ts,tsx}'],
  outdir: 'styled-system',
  importMap: '#styled-system',
  preflight: false,
} satisfies Config)
```

2. Map `#styled-system/*` in `package.json`, mark `*.css` in `sideEffects` so consumer bundlers do not tree-shake the stylesheet, and add `"prepare": "panda codegen"` when `@pandacss/dev` is installed:

```json
{
  "name": "@my-org/ui",
  "type": "module",
  "sideEffects": ["*.css"],
  "imports": {
    "#styled-system/*": "./styled-system/*/index.js"
  },
  "scripts": {
    "prepare": "panda codegen",
    "build": "tsdown"
  }
}
```

3. Configure `tsdown.config.ts`. Enable tsdown's `exports` generation so `package.json#exports` updates automatically (otherwise export entries must be maintained by hand):

```ts
// tsdown.config.ts
import {pandaCssPlugin} from '@sanity/pandacss-tsdown-plugin'
import {defineConfig} from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  exports: true,
  plugins: [
    pandaCssPlugin({
      inject: true,
      exports: {nodeCompat: true},
    }),
  ],
})
```

## Using with `@sanity/tsdown-config`

In packages that use [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme), enable the plugin with `panda: true` (or pass an options object):

```ts
// tsdown.config.ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  panda: true,
})
```

### Defaults: standalone plugin vs `@sanity/tsdown-config`

| Feature     | Standalone `pandaCssPlugin()`                                             | `@sanity/tsdown-config` (`panda: true`)                                                                              |
| ----------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `codegen`   | `true`                                                                    | `true`                                                                                                               |
| `transform` | `true`                                                                    | `true`                                                                                                               |
| `fileName`  | `'styles.css'`                                                            | `'styles.css'`                                                                                                       |
| `inject`    | `false`                                                                   | `true`                                                                                                               |
| `exports`   | `false`                                                                   | `{nodeCompat: true}`                                                                                                 |
| `minify`    | `false`                                                                   | `false`                                                                                                              |
| `target`    | tsdown's `target` (skips syntax transforms when no browser target is set) | tsdown's `target`, falling back to `@sanity/browserslist-config` when the effective target does not specify browsers |

## Important behavior and limitations

### Sources and scanning

Every file matched by the `include` and `exclude` globs in `panda.config.ts` is scanned when the build starts, and all scanned files contribute rules to the emitted `styles.css` — including files matched by `include` that no bundle entry imports. Files inside the generated `outdir` (`styled-system`) are always excluded from scanning and transformation.

### Codegen

By default (`codegen: true`), the plugin runs Panda's codegen before bundling and again after config reloads in watch mode. Unchanged files are not rewritten on disk. Set `codegen: false` when codegen is managed externally, or set `outdir` to override the `outdir` configured in `panda.config.ts`. Keep `"prepare": "panda codegen"` in `package.json` if your editor, linter, typecheck, or tests run before `tsdown`.

### Build-time transformation and dynamic calls

`transform` defaults to `true` (unlike `@pandacss/vite`, where it defaults to `false`). Statically resolvable `css({...})` calls are rewritten into class name strings at build time.

- **Non-static compositions** (such as merging multiple style arguments conditionally) use the transformer's small internal class-merging helper rather than the full `styled-system` runtime.
- **Unresolvable dynamic calls** cannot be rewritten statically: they retain their `styled-system` runtime imports in the output bundle, and Panda cannot extract CSS rules for arbitrary values computed only at runtime.
- Set `transform: false` to skip the build-time rewrite and keep all `styled-system` runtime calls.

### Watch mode

In `tsdown --watch`, the plugin watches `panda.config.ts`, any token or preset files imported by the config, and the scanned source directories. Editing the config or its dependencies reloads the Panda driver, updates the source filter, re-runs codegen, and invalidates affected modules.

### Stylesheet output, cascade layers, and optimization

- **Cascade layers:** The plugin requests all Panda layers (`reset`, `base`, `tokens`, `recipes`, `utilities`) with `emitLayerDeclaration: false`. Individual `@layer <name> { ... }` blocks are still emitted in `styles.css`, while the top-level `@layer reset, base, tokens, recipes, utilities;` order statement is omitted so the consuming application controls layer ordering.
- **Optimization vs minification:** Lightning CSS always runs to strip Panda's `--made-with-panda` custom property (plus any symbols in `lightningcss.unusedSymbols`) and transform CSS syntax for the configured `target`. Whitespace minification is separate and opt-in via `minify: true`.

### CSS import injection (`inject`)

When `inject` is enabled (`true` or `{nodeCompat: true}`), the plugin inserts an `import` statement (or `require()` in CommonJS chunks, placed after any hashbang and `"use strict"` directive prologue) at the top of each JS entry chunk that uses Panda styles. It does not inline CSS into JavaScript or inject `<style>` tags at runtime; declaration (`.d.ts`) chunks are never modified.

### Conditional exports (`exports`)

When `exports: {nodeCompat: true}` is enabled alongside tsdown's `exports` generation, the plugin emits a comment-only `styles-css.js` no-op shim (valid in both ESM and CommonJS) and a `styles-css.d.ts` declaration file next to `styles.css`, and writes a conditional export entry to `package.json`:

```json
{
  "./styles.css": {
    "types": "./dist/styles-css.d.ts",
    "style": "./dist/styles.css",
    "browser": "./dist/styles.css",
    "module": "./dist/styles.css",
    "node": {
      "types": "./dist/styles-css.d.ts",
      "default": "./dist/styles-css.js"
    },
    "default": "./dist/styles.css"
  }
}
```

- `types` comes first so TypeScript (`moduleResolution: "bundler"` / `"node16"` / `"nodenext"` with `noUncheckedSideEffectImports`) resolves the declaration file.
- `style`, `browser`, and `module` resolve to the real `./dist/styles.css` stylesheet in CSS-aware bundlers.
- `node` resolves to the no-op `./dist/styles-css.js` shim so Node.js (`import` and `require`), SSR, and test runners do not fail with `ERR_UNKNOWN_FILE_EXTENSION` when an entry chunk imports `<pkg>/styles.css`.
- Set `exports: {nodeCompat: false}` for a plain `"./styles.css": "./dist/styles.css"` export without shims.

## Options

| Option         | Type                                | Default             | Description                                                                                                                                        |
| -------------- | ----------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd`          | `string`                            | tsdown's `cwd`      | Working directory used to discover `panda.config.*` and resolve `include`/`exclude` globs.                                                         |
| `configPath`   | `string`                            | discovered upward   | Explicit path to the Panda config file.                                                                                                            |
| `codegen`      | `boolean`                           | `true`              | Run `driver.codegen()` at build start and on watch-mode config reloads ([details](#codegen)).                                                      |
| `outdir`       | `string`                            | config's `outdir`   | Override Panda's generated `styled-system` directory (distinct from tsdown's `outDir`, which controls the build output directory such as `dist/`). |
| `transform`    | `boolean`                           | `true`              | Rewrite statically resolvable style calls into class names via `@pandacss/transformer` ([details](#build-time-transformation-and-dynamic-calls)).  |
| `fileName`     | `string`                            | `'styles.css'`      | Emitted CSS asset filename inside tsdown's `outDir`.                                                                                               |
| `inject`       | `boolean \| {nodeCompat?: boolean}` | `false`             | Insert a CSS import into JS entry chunks that use Panda styles ([details](#css-import-injection-inject)).                                          |
| `exports`      | `boolean \| CssExportsOptions`      | `false`             | Register `./<fileName>` in `package.json#exports` and emit Node-compat shims ([details](#conditional-exports-exports)).                            |
| `minify`       | `boolean`                           | `false`             | Minify the emitted CSS with Lightning CSS.                                                                                                         |
| `target`       | `string \| string[] \| false`       | tsdown's `target`   | Browser targets for Lightning CSS syntax transforms (see [Target resolution](#target-resolution)).                                                 |
| `lightningcss` | `LightningCSSOptions`               | `undefined`         | Additional options forwarded to `lightningcss.transform()` (`cssModules` is forced to `false` so Panda's class names stay intact).                 |
| `packageName`  | `string`                            | `package.json#name` | Explicit package name for self-referential `inject` imports when running outside tsdown.                                                           |

### Target resolution

- `lightningcss.targets` takes highest precedence when explicitly provided.
- Otherwise, `target` (falling back to tsdown's top-level `target`) accepts esbuild-style browser targets (`'chrome120'`, `['chrome102', 'edge105', 'safari16.4']`) or browserslist queries (`'defaults'`, `'> 0.5%'`).
- `target: false` disables CSS syntax transforms completely.
- Targets that do not specify browsers (such as `'node20'` or `'es2022'`) produce no browser targets in the standalone plugin; when used via `@sanity/tsdown-config`'s `panda` option, they fall back to `@sanity/browserslist-config`.

## Advanced details and related docs

- Custom export condition order can be configured via `exports: {nodeCompat: true, conditions: [...]}` (`DEFAULT_CSS_EXPORT_CONDITIONS` is `['style', 'browser', 'module', 'node', 'default']`, with `types` always prepended).
- If a user-defined `exports.customExports` callback in `tsdown.config.ts` explicitly sets `"./styles.css"`, that custom entry is preserved.
- Related packages:
  - [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme)
  - [`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme)
  - [Panda CSS documentation](https://panda-css.com)

## License

MIT © [Sanity.io](https://www.sanity.io/)
