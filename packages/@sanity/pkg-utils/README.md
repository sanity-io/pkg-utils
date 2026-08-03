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

During local builds the `exports` map is regenerated from the build (with `source` conditions for
development, and a `source`-less `publishConfig.exports` for publishing) and kept in sync; in CI
the committed `package.json` is used as-is.

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

#### `clean`

- Type: `boolean | string[]`
- Default: `true`

tsdown's [`clean` option](https://tsdown.dev/options/cleaning), passed through as-is. Cleaning is
on by default: `true` cleans the `dist` folder before the build, `false` skips cleaning, and a
`string[]` replaces the default with the listed paths/globs — include `dist` when you still want it
cleaned alongside other folders (e.g. `clean: ['dist', 'coverage']` replaces a
`"clean": "rimraf dist coverage"` script).

#### `define`

- Type: `Record<string, string | number | boolean | null | undefined>`
- Default: `{}`

An object defining globals within the package.

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

Runs `babel-plugin-react-compiler` (which must be installed) on the source files before they are
bundled, so published components are memoized automatically. Pass `true` for the defaults, or an
options object to configure the compiler (e.g. `{target: '18'}`).

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

- Type: `false | {customTags?: TSDocCustomTag[]; rules?: {...}}`
- Default: `undefined` (enabled)

Runs [API Extractor](https://api-extractor.com/) during `pkg check` to check that TSDoc tags are
valid and release tags are correct. Set `tsdoc: false` to disable it.

#### `vanillaExtract`

- Type: `boolean | PackageVanillaExtractOptions`
- Default: `false`

Extracts the CSS from [vanilla-extract](https://vanilla-extract.style) `.css.ts` files into
`dist/bundle.css` (minified and lowered with `lightningcss`), injects the self-referential
`import "<pkg>/bundle.css"`, emits a no-op `bundle-css.js` shim for runtimes that cannot import
`.css` files, and writes the conditional `"./bundle.css"` export to `package.json`.

## Migrating to v12

v12 replaced the rollup/rolldown build stack with `tsdown` + `@sanity/tsdown-config`. Removed
options throw an error with migration instructions when set (gated by
[`legacyChecks`](#legacychecks)); deprecated options keep working with a warning.

- `dts: 'rolldown'` — delete it: it is the default (and only) behavior now. Options that
  accompanied it move into the `dts` object, e.g. `tsgo: true` becomes `dts: {tsgo: true}`.
- `dts: 'api-extractor'` — removed. Types are generated with tsdown (rolldown-plugin-dts);
  API Extractor remains as the TSDoc/release-tag checking of `pkg check`, configured with
  [`tsdoc`](#tsdoc).
- `babel.reactCompiler` / `reactCompilerOptions` — the top-level
  [`reactCompiler`](#reactcompiler) option (`reactCompiler: {target: '18'}`).
- `babel.styledComponents` — the top-level [`styledComponents`](#styledcomponents) option, now an
  oxc native transform: `babel-plugin-styled-components` can be uninstalled.
- `babel.plugins` — use [`plugins`](#plugins) with a self-installed `@rolldown/plugin-babel`:
  ```ts
  import pluginBabel from '@rolldown/plugin-babel'
  export default defineConfig({
    plugins: [await pluginBabel({plugins: ['babel-plugin-example']})],
  })
  ```
- `rollup.vanillaExtract` — the top-level [`vanillaExtract`](#vanillaextract) option.
- `rollup.plugins` — the top-level [`plugins`](#plugins) option (rolldown plugins; most Rollup
  plugins are compatible). `rollup.output`, `rollup.treeshake`,
  `rollup.experimentalLogSideEffects` and `rollup.hashChunkFileNames` have no successor — shared
  chunks are content-hashed now, so they can never collide with entry filenames.
- `rollup.optimizeLodash` — removed, including the implicit lodash-import optimization that was
  applied whenever `lodash` was a dependency. Preferably drop lodash altogether (see
  [e18e.dev](https://e18e.dev) for module replacements like `es-toolkit`), or import from
  `lodash-es`, which tree-shakes in consumers without build-time rewriting.
- `extract` — TSDoc checking is configured with [`tsdoc`](#tsdoc) (`extract: {enabled: false}`
  becomes `tsdoc: false`; `rules`/`customTags` carry over). Type inlining
  (`extract.bundledPackages`) follows the bundling decisions now: imported devDependencies are
  inlined automatically, and `deps: {alwaysBundle: [...]}` forces inlining a dependency.
  `extract.checkTypes` has no successor — type generation no longer type-checks.
- `external` — deprecated but still works: use `deps: {neverBundle: [...]}` to mark dependencies
  as external, and `deps: {alwaysBundle: [...]}` to bundle a dependency (the callback pattern that
  filtered entries out of the defaults).
- `jsx`, `jsxFactory`, `jsxFragment`, `jsxImportSource` — configure JSX through `tsconfig.json`
  (`compilerOptions.jsx` and friends); the bundler reads it from there.
- `process.env.PKG_FORMAT` and `process.env.PKG_FILE_PATH` are no longer replaced at build time
  (`PKG_RUNTIME` and `PKG_VERSION` still are). For per-format or per-runtime code, use
  [conditional `package.json#imports`](https://nodejs.org/api/packages.html#imports), which
  resolve with far more precision (`require` vs `import`, `node`/`browser`/`worker`, `deno`,
  `react-server`, and other conditions compose). For a file's own location, use
  `import.meta.url` (with tsdown's `shims` for CJS output).
- `pkg build --clean` — deprecated no-op: cleaning is on by default now. Use
  [`clean`](#clean)`: false` to opt out.
- Building requires Node.js `^22.18.0 || >=24.11.0` (the published output is unaffected).

## License

MIT
