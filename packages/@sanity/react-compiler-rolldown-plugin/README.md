# @sanity/react-compiler-rolldown-plugin

A [rolldown](https://rolldown.rs) plugin — usable as-is in [tsdown](https://tsdown.dev) and
[Vite](https://vite.dev) — that opts allow-listed Sanity API surfaces into
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

## The problem

React Compiler's `infer` mode only compiles functions it can prove are components or hooks:
declarations and variable bindings whose names are PascalCase or `use`-prefixed, that create
JSX or call hooks. Object-property functions never qualify — not even PascalCase ones — so the
component-in-an-object patterns Sanity APIs are built on are invisible to it.

The compiler can't lift this restriction itself: it has no way to know whether a function in
an arbitrary object is rendered as a component or invoked as a plain call (where the injected
memo cache — a hook — would break). Sanity tooling _does_ know its own API surfaces, so it can
maintain the allow-list the compiler can't.

Any function carrying a `'use memo'` directive is compiled regardless of position — inline,
inside the object literal. For module-scope objects the property reference is already stable
across renders, so the directive alone captures the full memoization win, with none of the
scope/closure hazards of hoisting functions to module scope.

## The one rule: run it before the React Compiler

The plugin only _annotates_ — it runs completely independently of the React Compiler
pipeline, with a single ordering rule: its `transform` must run **before** the compiler's
babel pass, so the compiler sees (and acts on) the injected directives. In rolldown and
tsdown that means placing it earlier in the `plugins` array than the compiler's babel plugin;
in Vite the plugin carries `enforce: 'pre'`, which handles the ordering automatically
(rolldown and tsdown ignore that Vite-only property). Without a compiler pass downstream the
injected directives are inert strings.

## Usage

### rolldown

Following the [tsdown React Compiler recipe](https://tsdown.dev/recipes/react-support#enabling-react-compiler)'s
babel setup:

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

### tsdown

Same shape in `tsdown.config.ts`:

```ts
import {pluginBabel} from '@rolldown/plugin-babel'
import {reactCompilerSurfacesPlugin} from '@sanity/react-compiler-rolldown-plugin'
import {reactCompilerPreset} from '@vitejs/plugin-react'
import {defineConfig} from 'tsdown'

export default defineConfig({
  plugins: [
    reactCompilerSurfacesPlugin(),
    pluginBabel({presets: [reactCompilerPreset({target: '19'})]}),
  ],
})
```

With [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme)
(whose `reactCompiler` option owns the babel pass), prepend the plugin through `mergeConfig`
so it lands before the compiler:

```ts
import {reactCompilerSurfacesPlugin} from '@sanity/react-compiler-rolldown-plugin'
import {defineConfig} from '@sanity/tsdown-config'
import {mergeConfig} from 'tsdown'

export default mergeConfig(
  {plugins: [reactCompilerSurfacesPlugin()]},
  await defineConfig({
    tsconfig: 'tsconfig.dist.json',
    reactCompiler: {target: '19'},
  }),
)
```

### Sanity Studio (`sanity.cli.ts`)

The React Compiler is enabled with the
[`reactCompiler` option in `sanity.cli.ts`](https://www.sanity.io/docs/cli-reference/cli-config);
add this plugin through the `vite` override — `enforce: 'pre'` places it before the CLI's
compiler pass in both `sanity dev` and `sanity build`:

```sh
npm install --save-dev babel-plugin-react-compiler @sanity/react-compiler-rolldown-plugin
```

```ts
import {reactCompilerSurfacesPlugin} from '@sanity/react-compiler-rolldown-plugin'
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
schema files are memoized by the compiler like any top-level component would be.

### Other Vite apps

```ts
import babel from '@rolldown/plugin-babel'
import {reactCompilerSurfacesPlugin} from '@sanity/react-compiler-rolldown-plugin'
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

## Built-in surfaces

| Surface         | Anchors                                                                                                                                         | Annotated                                                                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sanity-config` | `defineConfig` / `definePlugin` from `sanity` (module scope; workspace arrays and `definePlugin(() => ({…}))` factories are followed)           | `form.components.*`, `studio.components.*`, and any `use*`-named function prop anywhere in the config — including inside plugin-factory arguments like `assist({fieldActions: {useFieldActions}})` |
| `sanity-schema` | `defineType` / `defineField` / `defineArrayMember` from `sanity` or `@sanity/types`                                                             | `components.{input,field,item,preview,block,inlineBlock,annotation,diff}` at any nesting depth (inline fields behind `fields`/`of` arrays included)                                                |
| `portabletext`  | Object literals typed `PortableTextComponents` / `PortableTextReactComponents` from `@portabletext/react` (via `: T`, `satisfies T`, or `as T`) | Every function-valued member, to a depth of two (`types.*`, `marks.*`, `block.*`, `list.*`, `listItem.*`, and top-level slots like `hardBreak`)                                                    |

Custom surfaces can be passed through the `surfaces` option — see the `Surface` type.

### Why these surfaces are safe

Injecting `'use memo'` makes the compiler give a function a memo cache, which is backed by a
hook — so the function must only ever be invoked during render (as a component, or as a hook).
Each built-in slot was vetted against how the host invokes it:

- Sanity Studio renders `form.components.*` and `studio.components.*` through its middleware
  component chain (`useMiddlewareComponents`), and schema `components.*` slots through the
  form builder — always as React elements, never as plain calls.
- `@portabletext/react` renders every member of `PortableTextReactComponents` as a React
  element.
- `use*`-named function props in the Sanity config (e.g. `useFieldActions` in
  `@sanity/assist`) are hook contracts, called during render.

### Deliberately excluded

- **`icon`** (schema types, config): icons are commonly invoked as plain calls outside render
  — e.g. `renderToStaticMarkup(type.icon())` — where a memo cache would crash.
- **`document.actions` / `document.badges`**: document actions are hooks named like
  components; annotating them is planned but needs its own vetting.
- **Anything the transform can't prove**: computed keys, `async` functions and generators
  (never components/hooks), functions that already carry a compiler directive
  (`'use memo'` / `'use no memo'` / `use memo if(…)`), and modules with a top-level
  `'use no memo'` are all left alone.

## Options

- `surfaces` — the API surfaces to annotate (defaults to the built-in Sanity + PortableText
  surfaces; custom `Surface` definitions can be added).
- `include` / `exclude` — module id filters (defaults: JS/TS sources, skipping
  `node_modules` and virtual modules).

The transform parses with [`yuku-parser`](https://www.npmjs.com/package/yuku-parser) (the
oxc-shaped TS-ESTree AST) and splices offset-based edits through
[`magic-string`](https://www.npmjs.com/package/magic-string) — untouched code stays
byte-identical, TypeScript passes through, and the returned sourcemap composes with the
bundler's own chain. The `transform` hook declares `id` and `code` filters, so rolldown skips
the Rust ↔ JS roundtrip for modules that cannot contain an anchor. The transform itself is
also exported as `annotateReactCompilerSurfaces(source, {filename, surfaces})` for
programmatic use.

## Escape hatch

The standard React Compiler opt-outs keep working: add `'use no memo'` to a function (or the
top of a module) and the plugin won't touch it.

## License

MIT
