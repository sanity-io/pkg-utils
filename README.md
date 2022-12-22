# @sanity/pkg-utils

Simple utilities for modern [npm](https://www.npmjs.com/) packages.

```sh
npm install @sanity/pkg-utils -D
```

[![npm version](https://img.shields.io/npm/v/@sanity/pkg-utils.svg?style=flat-square)](https://www.npmjs.com/package/@sanity/pkg-utils)

## Basic usage

```sh
# In a Node.js package directory with `package.json` present

# Check the package
# This will validate the package.json file
pkg-utils

# Build the package
pkg-utils build --tsconfig tsconfig.dist.json

# Watch the package
pkg-utils watch --tsconfig tsconfig.dist.json
```

Run `pkg-utils -h` for more information on CLI usage.

## Configuration

`@sanity/pkg-utils` reads most of its configuration from `package.json`. But sometimes you need more
control. You may then add a configuration file named `package.config.ts` (or `.js`, `.cjs`, or
`.mjs`).

```ts
// package.config.ts

import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  // Minify bundled JavaScript
  minify: true,
})
```

### Options

#### `bundles`

- Type: `PkgBundle[]`
- Default: `undefined`

An array of entry points to bundle. This is useful if you want to bundle something that should not
be exported by the package, e.g. CLI scripts or Node.js workers.

#### `define`

- Type: `Record<string, string | number | boolean | null | undefined>`
- Default: `{}`

An object defining globals within the package.

#### `dist`

- Type: `string`
- Default: `'./dist'`

The path to the directory to which bundle and chunk files should be written.

#### `exports`

- Type: `PkgConfigProperty<PkgExports>`
- Default: the value of `"exports"` in `package.json`

Override or modify the value of the `exports` before it’s parsed internally.

#### `extract`

- Type:
  ```ts
  {
    rules?: {
      'ae-forgotten-export'?: PkgRuleLevel
      'ae-incompatible-release-tags'?: PkgRuleLevel
      'ae-internal-missing-underscore'?: PkgRuleLevel
      'ae-missing-release-tag'?: PkgRuleLevel
    }
  }
  ```
- Default: `undefined`

Configure the level of reporting of \`@microsoft/api-extractor\` (which is used to bundle the
type definitions, as well as lint the TSDoc of the package).

#### `external`

- Type: `string[]`
- Default: `[]`

Packages to exclude from bundles.

#### `jsx`

- Type: `'transform' | 'preserve' | 'automatic'`
- Default: `'automatic'`

Strategy for bundling JSX.

#### `jsxFactory`

- Type: `string`
- Default: `'createElement'`

The name of the function that creates JSX elements.

#### `jsxFragment`

- Type: `string`
- Default: `'Fragment'`

The name of JSX fragment elements.

#### `jsxImportSource`

- Type: `string`
- Default: `'react'`

The name of the library from which to import JSX factory and fragment names.

#### `legacyExports`

- Type: `boolean`
- Default: `false`

Build package with support for legacy exports (writes root `<export>.js` files). Use this if you
need to support older Node.js versions or older bundlers.

#### `minify`

- Type: `boolean`
- Default: `false`

Whether to minify the bundled JavaScript.

#### `rollup.plugins`

- Type: `PkgConfigProperty<RollupPlugin[]>`
- Default: `[]`

Rollup plugins to load when bundling.

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

#### `tsconfig`

- Type: `string`
- Default: `'tsconfig.json'`

The path to the TypeScript configuration file.

## License

MIT
