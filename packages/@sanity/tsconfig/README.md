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

### Recommended <kbd><a href="./bases/recommended.json">tsconfig.json</a></kbd>



### Strict

### Strictest

### Isolated Declarations


[`@sanity/tsconfig/recommended`]: #recommended
[`@sanity/tsconfig/strict`]: #strict
[`@sanity/tsconfig/strictest`]: #strictest
[`@sanity/tsconfig/isolated-declarations`]: #isolated-declarations
