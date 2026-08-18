# @sanity/pkg-utils

Simple utilities for modern [npm](https://www.npmjs.com/) packages.

```sh
npm install @sanity/pkg-utils -D
```

[![npm version](https://img.shields.io/npm/v/@sanity/pkg-utils.svg?style=flat-square)](https://www.npmjs.com/package/@sanity/pkg-utils)

## Basic usage

```sh
# Initialize a new package
pnpx @sanity/pkg-utils@latest init my-package

# In a Node.js package directory with `package.json` present

# Check the package
pkg-utils check

# Build the package
pkg-utils build

# Watch the package
pkg-utils watch
```

Run `pkg-utils -h` for more information on CLI usage.

## How it works

Since v12, `@sanity/pkg-utils` composes [`tsdown`](https://tsdown.dev) and
[`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme):
the hand-written `exports` map in `package.json` stays the input that decides what gets built, and
for every platform (the default build, plus one extra build per `browser`/`node` exports condition)
pkg-utils resolves a config from `@sanity/tsdown-config`, layers its own opinions over it
(browserslist-driven syntax targets, build-time constants, exports reconciliation), and runs
tsdown's programmatic `build()`.

`tsdown.config.*` files are never loaded — `package.config.ts` is the only configuration source of
`pkg build`. For customizations beyond the options below, use `tsdown` +
`@sanity/tsdown-config` directly instead.

Builds regenerate the `exports` map from the build (with `source` conditions for development, and
a `source`-less `publishConfig.exports` for publishing) and keep it in sync — including in CI —
so environments that set `CI=true` without meaning "skip package.json" still behave correctly.
For conditional entries, generated conditions are materialized in both maps, then the authored
subpath and condition order of each map is preserved independently on later builds. Plain-string
entries keep their compact shape. This lets you reorder conditions directly in `package.json`;
earlier matching conditions take precedence over later ones.

## Configuration

`@sanity/pkg-utils` reads most of its configuration from `package.json`. But sometimes you need more
control. You may then add a configuration file named `package.config.ts` (or `.mts`, `.js`, or
`.mjs`).

```ts
// package.config.ts

import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsdoc: {
    rules: {
      // do not require internal members to be prefixed with `_`
      'ae-internal-missing-underscore': 'off',
    },
  },

  // the path to the tsconfig file for distributed builds
  tsconfig: 'tsconfig.dist.json',
})
```

### Options

#### `bundles`

- Type: `PkgBundle[]`
- Default: `undefined`

An array of entry points to bundle. This is useful if you want to bundle something that should not
be exported by the package, e.g. CLI scripts or Node.js workers.

#### `bundleAnalyzer`

- Type: `boolean | PackageBundleAnalyzerOptions`
- Default: `false`

Enables Rolldown's experimental
[`bundleAnalyzerPlugin`](https://rolldown.rs/builtin-plugins/bundle-analyzer) to emit a report of
what the package itself bundles. Pass `true` for the defaults (`format: 'md'`, an LLM-friendly
`analyze-data.md` in `dist`), or an options object to customize. Analysis adds work to the build,
so this stays off by default — typical usage is an env-gated opt-in:

```ts
export default defineConfig({
  bundleAnalyzer: process.env.ENABLE_BUNDLE_ANALYZER === 'true',
})
```

The report is **not** a publishable artifact. Exclude it from `package.json` `files` (e.g.
`"!dist/analyze-data.md"`) so an accidental analyze build cannot ship it.

#### `clean`

- Type: `boolean | string[]`
- Default: `true`

tsdown's [`clean` option](https://tsdown.dev/options/cleaning), passed through as-is. Cleaning is
on by default: `true` cleans the `dist` folder before the build, `false` skips cleaning, and a
`string[]` replaces the default with the listed paths/globs — include `dist` when you still want it
cleaned alongside other folders (e.g. `clean: ['dist', 'coverage']` replaces a
`"clean": "rimraf dist coverage"` script). `pkg build --no-clean` skips cleaning for a single run.

#### `define`

- Type: `Record<string, string | number | boolean | null | undefined>`
- Default: `{}`

An object defining globals within the package. `process.env.PKG_VERSION` is always defined,
replaced with the package's `version` (overridable with a `PKG_VERSION` environment variable).

#### `deps`

- Type: `UserConfig['deps']`
- Default: `undefined`

tsdown's [`deps` option](https://tsdown.dev/options/dependencies), passed through as-is:
`neverBundle` marks dependencies as external, `alwaysBundle` forces a dependency to be inlined
(types included — type inlining follows the bundling decisions). Note tsdown's matching semantics:
strings match exactly (or as globs), so covering subpath imports takes a pattern like
`/^@scope\/name(\/|$)/`.

#### `dist`

- Type: `string`
- Default: `'./dist'`

The path to the directory to which bundle and chunk files should be written.

#### `dts`

- Type: `false | DtsOptions`
- Default: `undefined`

tsdown's [`dts` options](https://tsdown.dev/options/dts), passed through as-is (an object, or
`false` to skip generating `.d.ts` files entirely). For example `dts: {tsgo: true}` selects the
Go-native TypeScript compiler for type generation.

#### `exports`

- Type: `PkgConfigProperty<PkgExports>`
- Default: the value of `"exports"` in `package.json`

Override or modify the value of the `exports` before it’s parsed internally.

#### `legacyChecks`

- Type: `boolean`
- Default: `process.env.NODE_ENV !== 'production'`

Gates the migration checks for options that were removed or deprecated in v12 (they throw helpful
errors with migration instructions). On by default outside production builds, where migration
mistakes surface during development; skipped when `NODE_ENV=production`.

#### `minify`

- Type: `boolean`
- Default: `false`

Whether to fully minify the bundled JavaScript (identifier mangling and whitespace removal
included). The output is always compressed (constant folding, dead code elimination) with
function/class names preserved.

#### `plugins`

- Type: `UserConfig['plugins']`
- Default: `[]`

Extra [rolldown plugins](https://tsdown.dev/advanced/plugins), appended after the plugins
pkg-utils sets up. Most Rollup plugins are also compatible.

#### `reactCompiler`

- Type: `boolean | ReactCompilerOptions`
- Default: `false`

Runs the React Compiler on the source files before they are bundled, so published components
are memoized automatically. Pass `true` for the defaults, or an options object to configure the
compiler (e.g. `{target: '18'}`).

The `transform` option (of pkg-utils, never forwarded to the compiler) selects which
implementation runs: `'babel'` (the default) requires `babel-plugin-react-compiler` to be
installed, while the experimental `'oxc'` (e.g. `{target: '19', transform: 'oxc'}`)
requires [`oxc-transform-react`](https://www.npmjs.com/package/oxc-transform-react) — the Rust
port of the compiler, which also owns TypeScript/JSX lowering for the files it transforms. See
the [`@sanity/tsdown-config` docs](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#transforms-transform)
for the details and caveats.

#### `runtime`

- Type: `'*' | 'browser' | 'node'`
- Default: `'*'`

Default runtime of package exports

#### `sourcemap`

- Type: `boolean`
- Default: `true`

Whether to include source map files.

#### `src`

- Type: `string`
- Default: `'./src'`

The path to the directory in which source code is located.

#### `styledComponents`

- Type: `boolean | StyledComponentsOptions`
- Default: `false`

Applies the `styled-components` transform (`displayName`, `componentId`, CSS minification, etc)
using oxc's native port of `babel-plugin-styled-components` — no Babel dependencies required.

#### `tsconfig`

- Type: `string`
- Default: `'tsconfig.json'`

The path to the TypeScript configuration file.

#### `tsdoc`

- Type: `boolean | PackageTsdocOptions`
- Default: `true`

Runs [API Extractor](https://api-extractor.com/) during `pkg build` and again during
`pkg check` to check that TSDoc tags are valid and release tags are correct. Set
`tsdoc: false` to disable it.

#### `vanillaExtract`

- Type: `boolean | PackageVanillaExtractOptions`
- Default: `false`

Extracts the CSS from [vanilla-extract](https://vanilla-extract.style) `.css.ts` files into
`dist/bundle.css` (minified and lowered with `lightningcss`), injects the self-referential
`import "<pkg>/bundle.css"`, emits a no-op `bundle-css.js` shim for runtimes that cannot import
`.css` files, and writes the conditional `"./bundle.css"` export to `package.json`.

#### `css`

- Type: `PackageCssOptions`
- Default: `undefined`

Enables the [`@tsdown/css`](https://www.npmjs.com/package/@tsdown/css) pipeline (install it
first — it is an optional peer dependency) for plain CSS, CSS modules, preprocessors, and
Lightning CSS / PostCSS. The emitted CSS gets the same minify and lowering settings as
[`vanillaExtract`](#vanillaextract), and the same conditional CSS export treatment: the
self-referential `import "<pkg>/style.css"`, a no-op `style-css.js` shim with its
`style-css.d.ts` declaration, and the conditional `"./style.css"` export written to
`package.json`.

### Shipping a stylesheet as its own export subpath

A package can also publish a stylesheet directly, without any JS importing it. Declare a `.css`
export subpath with a `source` and nothing else:

```json
{
  "exports": {
    ".": {"source": "./src/index.ts", "default": "./dist/index.js"},
    "./ui/styles.css": {"source": "./src/ui/styles.css"},
    "./package.json": "./package.json"
  }
}
```

`pkg build` compiles `./src/ui/styles.css` to `dist/ui/styles.css` — the emitted path follows the
export subpath — and fills in the rest of the conditions:

```json
"./ui/styles.css": {
  "source": "./src/ui/styles.css",
  "types": "./dist/ui/styles-css.d.ts",
  "browser": "./dist/ui/styles.css",
  "style": "./dist/ui/styles.css",
  "node": "./dist/ui/styles-css.js",
  "default": "./dist/ui/styles-css.js"
}
```

Consumers then `import "<pkg>/ui/styles.css"`, which resolves to the stylesheet in bundlers and
browsers, and to the no-op shim in Node and similar runtimes. This turns on the `@tsdown/css`
pipeline automatically; set [`css`](#css) explicitly to customize it.

Add the CSS to `sideEffects` in `package.json` so it survives tree-shaking in consumers:

```json
{
  "sideEffects": ["*.css"]
}
```

## Migrating to v12

v12 replaced the rollup/rolldown build stack with `tsdown` + `@sanity/tsdown-config`. Most
packages need no changes; removed options throw an error with migration instructions when set
(gated by [`legacyChecks`](#legacychecks)), and deprecated options keep working with a warning.

See [MIGRATE.md](./MIGRATE.md) for the full guide — including how
[conditional `package.json#imports`](https://nodejs.org/api/packages.html#imports) replace the
removed `PKG_FORMAT`/`PKG_RUNTIME` constants, and `import.meta.url` replaces `PKG_FILE_PATH`.

## License

MIT
