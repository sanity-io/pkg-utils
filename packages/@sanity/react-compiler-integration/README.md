# @sanity/react-compiler-integration

Injects [`'use memo'`](https://react.dev/reference/react-compiler/directives) React Compiler
opt-in directives into the function-valued object properties of allow-listed Sanity API
surfaces, so [`babel-plugin-react-compiler`](https://www.npmjs.com/package/babel-plugin-react-compiler)
memoizes components and hooks its `infer` mode never sees.

This is the shared transform core behind
[`@sanity/react-compiler-rolldown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-rolldown-plugin#readme),
[`@sanity/react-compiler-vite-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-vite-plugin#readme), and
[`@sanity/react-compiler-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-tsdown-plugin#readme).

## The problem

React Compiler's `infer` mode only compiles functions it can prove are components or hooks:
declarations and variable bindings whose names are PascalCase or `use`-prefixed, that create
JSX or call hooks. Object-property functions never qualify — not even PascalCase ones — so the
component-in-an-object patterns Sanity APIs are built on are invisible to it:

```tsx
export default defineConfig({
  form: {
    components: {
      // Never compiled: an anonymous arrow in an object property
      input: (props) =>
        props.schemaType?.name === 'string' ? <CustomStringInput {...props} /> : props.renderDefault(props),
    },
  },
})
```

The compiler can't lift this restriction itself: it has no way to know whether a function in
an arbitrary object is rendered as a component or invoked as a plain call (where the injected
memo cache — a hook — would break). Sanity tooling *does* know its own API surfaces, so it can
maintain the allow-list the compiler can't.

Any function carrying a `'use memo'` directive is compiled regardless of position — inline,
inside the object literal. For module-scope objects the property reference is already stable
across renders, so the directive alone captures the full memoization win, with none of the
scope/closure hazards of hoisting functions to module scope.

## Usage

```ts
import {annotateReactCompilerSurfaces} from '@sanity/react-compiler-integration'

const result = await annotateReactCompilerSurfaces(source, {filename: 'sanity.config.tsx'})
if (result) {
  const {code, map, annotated} = result
  // feed `code` to babel-plugin-react-compiler (directly, or through the bundler pipeline)
}
```

The transform parses with [`yuku-parser`](https://www.npmjs.com/package/yuku-parser) (the
oxc-shaped TS-ESTree AST) and splices offset-based edits through
[`magic-string`](https://www.npmjs.com/package/magic-string) — untouched code stays
byte-identical, TypeScript passes through, and the returned sourcemap composes with the
bundler's own chain. It returns `null` when nothing needs to change.

## Built-in surfaces

| Surface | Anchors | Annotated |
| --- | --- | --- |
| `sanity-config` | `defineConfig` / `definePlugin` from `sanity` (module scope; workspace arrays and `definePlugin(() => ({…}))` factories are followed) | `form.components.*`, `studio.components.*`, and any `use*`-named function prop anywhere in the config — including inside plugin-factory arguments like `assist({fieldActions: {useFieldActions}})` |
| `sanity-schema` | `defineType` / `defineField` / `defineArrayMember` from `sanity` or `@sanity/types` | `components.{input,field,item,preview,block,inlineBlock,annotation,diff}` at any nesting depth (inline fields behind `fields`/`of` arrays included) |
| `portabletext` | Object literals typed `PortableTextComponents` / `PortableTextReactComponents` from `@portabletext/react` (via `: T`, `satisfies T`, or `as T`) | Every function-valued member, to a depth of two (`types.*`, `marks.*`, `block.*`, `list.*`, `listItem.*`, and top-level slots like `hardBreak`) |

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

## Escape hatch

The standard React Compiler opt-outs keep working: add `'use no memo'` to a function (or the
top of a module) and the transform won't touch it.

## License

MIT
