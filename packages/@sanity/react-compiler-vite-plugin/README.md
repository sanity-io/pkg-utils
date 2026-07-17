# @sanity/react-compiler-vite-plugin

A [Vite](https://vite.dev) plugin that opts allow-listed Sanity API surfaces into
[React Compiler](https://react.dev/learn/react-compiler) memoization: it injects
[`'use memo'`](https://react.dev/reference/react-compiler/directives) directives into the
function-valued object properties of `defineConfig` / `defineType` component slots, `use*`
hook props, and PortableText component maps — the object-property components and hooks the
compiler's `infer` mode never compiles on its own:

```tsx
export default defineConfig({
  form: {
    components: {
      // Invisible to React Compiler's infer mode — annotated by this plugin, it compiles
      // in place and re-renders only when its props change:
      input: (props) =>
        props.schemaType?.name === 'string' ? (
          <CustomStringInput {...props} />
        ) : (
          props.renderDefault(props)
        ),
    },
  },
})
```

The transform, the built-in surfaces, and the safety model live in
[`@sanity/react-compiler-integration`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-integration#readme).

## Usage in a Sanity Studio

The plugin only _annotates_ — the React Compiler itself is enabled separately, with the
[`reactCompiler` option in `sanity.cli.ts`](https://www.sanity.io/docs/cli-reference/cli-config).
Install the compiler and this plugin:

```sh
npm install --save-dev babel-plugin-react-compiler @sanity/react-compiler-vite-plugin
```

Then wire both up in `sanity.cli.ts` — the plugin is `enforce: 'pre'`, so it runs before the
compiler's babel pass in both `sanity dev` and `sanity build`:

```ts
import {reactCompilerSurfacesPlugin} from '@sanity/react-compiler-vite-plugin'
import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {projectId: '<projectId>', dataset: '<dataset>'},
  reactCompiler: {target: '19'},
  vite: (viteConfig) => ({
    ...viteConfig,
    plugins: [reactCompilerSurfacesPlugin(), ...(viteConfig.plugins ?? [])],
  }),
})
```

With that in place, the custom components and hook props in your `sanity.config.ts` and
schema files (`form.components.*`, `studio.components.*`, schema `components.*` slots,
`useFieldActions` and friends, PortableText component maps) are memoized by the compiler like
any top-level component would be.

## Usage in other Vite apps

Add the plugin next to the React Compiler babel pass:

```ts
import babel from '@rolldown/plugin-babel'
import {reactCompilerSurfacesPlugin} from '@sanity/react-compiler-vite-plugin'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

export default defineConfig({
  plugins: [
    reactCompilerSurfacesPlugin(),
    react(),
    babel({presets: [reactCompilerPreset({target: '19'})]}),
  ],
})
```

## Options

- `surfaces` — the API surfaces to annotate (defaults to the built-in Sanity + PortableText
  surfaces; custom `Surface` definitions can be added).
- `include` / `exclude` — module id filters (defaults: JS/TS sources, skipping
  `node_modules` and virtual modules).

## Escape hatch

The standard React Compiler opt-outs keep working: add `'use no memo'` to a function (or the
top of a module) and the plugin won't touch it.

## License

MIT
