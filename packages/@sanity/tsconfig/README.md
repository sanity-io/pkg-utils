# @sanity/tsconfig

Shared tsconfig.json presets following best practices at Sanity.io

## Installation

Add the package to your `"devDependencies"`:

```sh
npm install --save-dev @sanity/tsconfig
# or
pnpm add --save-dev @sanity/tsconfig
# or
yarn add --dev @sanity/tsconfig
```

## Usage

Choose one of the presets as your base:

- [`@sanity/tsconfig/recommended`]
- [`@sanity/tsconfig/strict`]
- [`@sanity/tsconfig/strictest`]

You can optionally combine your base with [`@sanity/tsconfig/isolated-declarations`] if you're using build tools (like `rolldown` or `tsdown`) that can generate `.d.ts` files significantly faster when TypeScript is constrained with `"isolatedDeclarations": true`.

### Recommended <kbd><a href="./recommended.tsconfig.json">tsconfig.json</a></kbd>

Add to your `tsconfig.json`:

```json
{
  "extends": "@sanity/tsconfig/recommended"
}
```

The preset sets `outDir` to `${configDir}/dist`. Since [`${configDir}`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html#the-configdir-template-variable-for-configuration-files) resolves to the directory of the tsconfig that extends the preset, output lands in the `dist` folder next to your `package.json`, matching the defaults of `@sanity/pkg-utils` and `tsdown`. Set your own `outDir` to override it.

### Strict <kbd><a href="./strict.tsconfig.json">tsconfig.json</a></kbd>

Add to your `tsconfig.json`:

```json
{
  "extends": "@sanity/tsconfig/strict"
}
```

### Strictest <kbd><a href="./strictest.tsconfig.json">tsconfig.json</a></kbd>

Add to your `tsconfig.json`:

```json
{
  "extends": "@sanity/tsconfig/strictest"
}
```

### Isolated Declarations <kbd><a href="./isolated-declarations.tsconfig.json">tsconfig.json</a></kbd>

Extend the `isolated-declarations.json` preset in addition to your base.
If your `tsconfig.json` previously looked like this:

```json
{
  "extends": "@sanity/tsconfig/strict"
}
```

Then change `extends` to an array and `isolated-declarations` to the end:

```json
{
  "extends": ["@sanity/tsconfig/strict", "@sanity/tsconfig/isolated-declarations"]
}
```

[`@sanity/tsconfig/recommended`]: #recommended-tsconfigjson
[`@sanity/tsconfig/strict`]: #strict
[`@sanity/tsconfig/strictest`]: #strictest
[`@sanity/tsconfig/isolated-declarations`]: #isolated-declarations
