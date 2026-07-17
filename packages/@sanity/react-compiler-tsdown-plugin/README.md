# @sanity/react-compiler-tsdown-plugin

A [tsdown](https://tsdown.dev) plugin that opts allow-listed Sanity API surfaces into
[React Compiler](https://react.dev/learn/react-compiler) memoization: it injects
[`'use memo'`](https://react.dev/reference/react-compiler/directives) directives into the
function-valued object properties of `defineConfig` / `defineType` component slots, `use*`
hook props, and PortableText component maps — the object-property components and hooks the
compiler's `infer` mode never compiles on its own.

It wraps the rolldown-generic
[`@sanity/react-compiler-rolldown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-rolldown-plugin#readme);
the transform, the built-in surfaces, and the safety model live in
[`@sanity/react-compiler-integration`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-integration#readme).

## Usage

With [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme),
enable the `reactCompilerSurfaces` option alongside `reactCompiler` — the config places the
plugin before the compiler's babel pass automatically:

```ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  reactCompiler: {target: '19'},
  reactCompilerSurfaces: true,
})
```

Standalone, place the plugin **before** the React Compiler's babel plugin (the
[tsdown React Compiler recipe](https://tsdown.dev/recipes/react-support#enabling-react-compiler)):

```ts
import {pluginBabel} from '@rolldown/plugin-babel'
import {reactCompilerSurfacesPlugin} from '@sanity/react-compiler-tsdown-plugin'
import {reactCompilerPreset} from '@vitejs/plugin-react'
import {defineConfig} from 'tsdown'

export default defineConfig({
  plugins: [
    reactCompilerSurfacesPlugin(),
    pluginBabel({presets: [reactCompilerPreset({target: '19'})]}),
  ],
})
```

## Options

- `surfaces` — the API surfaces to annotate (defaults to the built-in Sanity + PortableText
  surfaces; custom `Surface` definitions can be added).
- `include` / `exclude` — module id filters (defaults: JS/TS sources, skipping
  `node_modules` and virtual modules).

## License

MIT
