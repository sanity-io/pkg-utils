# @sanity/pandacss-tsdown-plugin

Panda CSS plugin for [`tsdown`](https://tsdown.dev).

## Installation

```sh
pnpm add -D @sanity/pandacss-tsdown-plugin @pandacss/dev tsdown
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

## License

MIT © [Sanity.io](https://www.sanity.io/)
