# @sanity/react-compiler-rolldown-plugin

A [rolldown](https://rolldown.rs) plugin that opts allow-listed Sanity API surfaces into
[React Compiler](https://react.dev/learn/react-compiler) memoization: it injects
[`'use memo'`](https://react.dev/reference/react-compiler/directives) directives into the
function-valued object properties of `defineConfig` / `defineType` component slots, `use*`
hook props, and PortableText component maps — the object-property components and hooks the
compiler's `infer` mode never compiles on its own.

The transform, the built-in surfaces, and the safety model live in
[`@sanity/react-compiler-integration`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-integration#readme).

## Usage

Place the plugin **before** the React Compiler's babel pass, e.g. following the
[tsdown React Compiler recipe](https://tsdown.dev/recipes/react-support#enabling-react-compiler):

```ts
import {pluginBabel} from '@rolldown/plugin-babel'
import {reactCompilerSurfacesPlugin} from '@sanity/react-compiler-rolldown-plugin'
import {reactCompilerPreset} from '@vitejs/plugin-react'
import {rolldown} from 'rolldown'

const bundle = await rolldown({
  input: 'src/index.tsx',
  plugins: [
    reactCompilerSurfacesPlugin(),
    await pluginBabel({presets: [reactCompilerPreset({target: '19'})]}),
  ],
})
```

With tsdown, prefer [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme)'s
`reactCompilerSurfaces` option (or [`@sanity/react-compiler-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-tsdown-plugin#readme) directly);
for Vite apps (including Sanity Studio), use
[`@sanity/react-compiler-vite-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-vite-plugin#readme).

## Options

- `surfaces` — the API surfaces to annotate (defaults to the built-in Sanity + PortableText
  surfaces; custom `Surface` definitions can be added).
- `include` / `exclude` — module id filters (defaults: JS/TS sources, skipping
  `node_modules` and virtual modules).

The `transform` hook declares `id` and `code` filters, so rolldown skips the Rust ↔ JS
roundtrip for modules that cannot contain an anchor.

## License

MIT
