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

The same React Compiler feature as `@sanity/pkg-utils` is available. It runs
[`babel-plugin-react-compiler`](https://react.dev/learn/react-compiler) on the source files before
they are bundled, so published components are memoized automatically. The plugin needs to be
installed separately:

```sh
pnpm add --save-dev babel-plugin-react-compiler
```

Then enable it:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  reactCompiler: true,
})
```

Pass an object to configure the compiler, using the same options as [`babel-plugin-react-compiler`](https://react.dev/reference/react-compiler/configuration):

```ts
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  reactCompiler: {target: '18'},
})
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
`.css.ts` files into a separate file (`dist/bundle.css` by default), minified and lowered with
`lightningcss` for the
[`@sanity/browserslist-config`](https://github.com/sanity-io/browserslist-config#readme)
browsers by default. Under the hood it uses
[`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme),
a tsdown-native port of `@vanilla-extract/rollup-plugin`, so enabling it doesn't pull `rollup`
into your project. Start by installing `@vanilla-extract/css` for authoring the `.css.ts` files:

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

By default (`inject: {nodeCompat: true}`) the conditional CSS export pattern is wired up
automatically:

- injects the self-referential `import "<pkg>/bundle.css"` into the entry chunks that use
  vanilla-extract styles,
- emits a no-op `bundle-css.js` shim (plus `bundle.css.d.ts` / `bundle-css.d.ts`) for runtimes
  that cannot import `.css` files, and
- writes the conditional `"./bundle.css"` export to `package.json` (`types` → the shim's `.d.ts`,
  `browser`/`style` → the real CSS, `node`/`default` → the shim).

The result is that `import "<pkg>/bundle.css"` resolves to the real CSS in bundlers/browsers and to
the no-op shim in Node and similar runtimes. Make sure the extracted CSS survives tree-shaking in
consumers by adding it to `sideEffects` in `package.json`:

```json
{
  "sideEffects": ["*.css"]
}
```

Pass an options object instead of `true` to customize - the options are modeled after the
[`css` options of `@tsdown/css`](https://tsdown.dev/options/css) (e.g. `fileName`, `minify`,
`target`, `lightningcss`). Set `inject: true` for a plain relative `import "./bundle.css"`
instead of the conditional export pattern, or `inject: false` to wire up the import, shim, and
export yourself.

Two Sanity-flavored defaults diverge from the bare plugins (which match `@tsdown/css` exactly):

- `minify` defaults to `true` - published Sanity libraries ship minified CSS. Set
  `minify: false` for readable output.
- The CSS syntax lowering `target` defaults to tsdown's top-level `target`, and when the
  effective target is undefined or names no browsers (e.g. `'node20'`, also what tsdown derives
  from `engines.node` - it speaks to the JS runtime, not the browsers the extracted CSS runs
  in), the lowering targets are resolved from `@sanity/browserslist-config` and passed through
  `lightningcss.targets`. The bare plugins (like `@tsdown/css`) would skip lowering in that
  case. `target: false` disables lowering entirely, and a user-provided `lightningcss.targets`
  wins over the fallback.

## dts

tsdown's [`dts` option](https://tsdown.dev/options/dts) is passed through as-is. By default tsdown
auto-detects it from `package.json` (it's enabled when a `types` field or a `types` condition in
`exports` is present). Pass an object to customize how the `.d.ts` files are generated, for example
to use [`tsgo`](https://github.com/microsoft/typescript-go) (the same feature as the `tsgo` option
in `@sanity/pkg-utils`, requires either `typescript` v7 or `@typescript/native-preview` to be
installed — with `typescript` v7 it's enabled automatically):

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: {tsgo: true},
})
```

## outDir

tsdown's [`outDir` option](https://tsdown.dev/options/output#outdir) is passed through as-is.
When left undefined, tsdown writes to `dist` (the same default as `@sanity/pkg-utils`):

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  outDir: 'lib',
})
```

## clean

tsdown's [`clean` option](https://tsdown.dev/options/cleaning) is passed through as-is. When left
undefined, tsdown defaults to `true` and removes `outDir` (`dist` by default) before each build.

Prefer an **array of folders** over a separate `"clean"` script in `package.json`. That way
`tsdown` / `pnpm build` clears the directories itself — packages don't need `rimraf`, a `clean`
script, or `prebuild` / `run-s clean build` wiring:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  // Instead of `"clean": "rimraf dist coverage"` (and running it before build):
  clean: ['dist', 'coverage'],
})
```

A `string[]` replaces tsdown's default (`true` → clean `outDir`), so include `outDir` (usually
`'dist'`) in the array when you still want it cleaned alongside other folders. Pass `false` to
skip cleaning entirely.

## Isolated declarations

If you're using the [`@sanity/tsconfig/isolated-declarations`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsconfig#isolated-declarations-tsconfigjson)
preset — which makes tsdown generate the `.d.ts` files with oxc's fast isolated declarations
transform — annotate the default export of `tsdown.config.ts` with `satisfies Promise<UserConfig>`:

```ts
import {defineConfig} from '@sanity/tsdown-config'
import type {UserConfig} from 'tsdown'

export default defineConfig() satisfies Promise<UserConfig>
```

Without the annotation, type-checking `tsdown.config.ts` with the `@sanity/tsconfig` presets (they
enable `declaration`) fails with TS2883 in pnpm projects: the inferred type of the default export
can only be named through `@sanity/tsdown-config`'s own copy of `tsdown`, which isn't portable.
`satisfies Promise<UserConfig>` names the type through your own `tsdown` dependency instead.

Keep the `isolated-declarations` preset scoped to the tsconfig that tsdown builds with (e.g. a
`tsconfig.dist.json` that only includes `./src`). If `isolatedDeclarations` covers
`tsdown.config.ts` itself, the default export can't be inferred at all (TS9037), and the config has
to move into an explicitly annotated variable instead:

```ts
import {defineConfig} from '@sanity/tsdown-config'
import type {UserConfig} from 'tsdown'

const config: Promise<UserConfig> = defineConfig()

export default config
```

## define

tsdown's `define` option is also passed through as-is. It replaces global identifiers with constant
expressions at build time (the same feature as the `define` option in `@sanity/pkg-utils`):

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  define: {'process.env.NODE_ENV': JSON.stringify('production')},
})
```

## sourcemap

tsdown's [`sourcemap` option](https://tsdown.dev/options/output#sourcemap) is forwarded with a
`true` default (the same as `@sanity/pkg-utils`). tsdown itself defaults to `false` and does not
read `sourceMap` from the tsconfig:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  sourcemap: false,
})
```

## deps

tsdown's [`deps` option](https://tsdown.dev/options/dependencies) is forwarded. When `platform` is
`'neutral'` (the default), `neverBundle` always includes `/^node:/` so node built-ins stay
external, and userland `neverBundle` entries are appended rather than replacing that default
(tsdown's `mergeConfig` would replace the array):

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  // Resulting neverBundle: [/^node:/, /^my-package(\/|$)/]
  deps: {neverBundle: [/^my-package(\/|$)/]},
})
```

`'neutral'` also restores `inputOptions.resolve.mainFields: ['module', 'main']` for inlined
dependencies that ship no `exports` map. Prefer it over `'node'` for packages that also run in
the browser - `'node'` makes CommonJS-interop emit a module-scope
`createRequire(import.meta.url)` for inlined CJS deps, which crashes browser-bundled consumers.

## target

tsdown's [`target` option](https://tsdown.dev/options/target) is also passed through as-is. It
downlevels JS syntax for the given runtimes (esbuild-style target strings), and doubles as the
default CSS syntax lowering target when `vanillaExtract` is enabled (browserless targets like
`node20` don't affect the CSS - it falls back to `@sanity/browserslist-config`):

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  target: ['chrome90', 'safari16'],
})
```

## exports

tsdown's [`exports` option](https://tsdown.dev/options/package-exports) is forwarded with
different defaults, suited for publishing Sanity libraries:

- `enabled: 'local-only'` - the `exports` map in `package.json` is generated during local builds
  and skipped in CI, where the committed `package.json` is already up to date, and
- `devExports: true` when pnpm is detected - the local `exports` map points at the source files
  (so monorepo siblings and editors resolve them directly), while `publishConfig.exports` receives
  the built files. This default is omitted for other or unknown package managers because they do
  not all reliably apply `publishConfig.exports` when publishing.

Userland values apply with tsdown's `mergeConfig` semantics: an object deep-merges over the
defaults (so individual fields can be overridden), while any other value - `false` to disable
exports generation, or a bare CI condition (`'ci-only'`/`'local-only'`) - replaces them entirely:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  exports: {all: true},
})
```

## Everything else: `mergeConfig`

`defineConfig` deliberately only exposes options you're likely to change. For anything else, merge
tsdown options over the returned config with tsdown's own `mergeConfig` - `defineConfig` returns a
promise, so `await` it first:

```ts
import {defineConfig} from '@sanity/tsdown-config'
import {mergeConfig} from 'tsdown'

export default mergeConfig(await defineConfig({tsconfig: 'tsconfig.dist.json'}), {
  // Any tsdown option, e.g. opting out of hashed chunk filenames:
  hash: false,
})
```
