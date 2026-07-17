/**
 * The allow-list model: a {@link Surface} describes one API surface whose function-valued
 * object properties are known to be render-invoked (as React components, or as hooks during
 * render), and are therefore safe to opt into React Compiler memoization with a `'use memo'`
 * directive — even though the compiler's own `infer` heuristics never compile object-property
 * functions (they only follow PascalCase/`use*` naming on declarations and variable bindings).
 */

/**
 * Call-expression anchors: module-scope calls to one of `names`, imported from one of
 * `sources`, mark their first argument (an object literal, an array of object literals, or a
 * factory function returning an object literal — the `definePlugin(() => ({…}))` shape) as a
 * surface object.
 * @public
 */
export interface SurfaceCallees {
  /** Imported binding names, e.g. `['defineConfig', 'definePlugin']`. */
  names: readonly string[]
  /**
   * Module specifiers the names must be imported from, matched against the literal import
   * source (so `defineConfig` from `'vite'` never anchors the `sanity` surface). Namespace
   * imports (`import * as sanity from 'sanity'; sanity.defineConfig(…)`) and aliased named
   * imports are followed.
   */
  sources: readonly string[]
}

/**
 * Type-annotation anchors: object literals annotated with one of `names` (via `: T` variable
 * annotations, `satisfies T`, or `as T`), where the type name is imported from one of
 * `sources`, are marked as surface objects.
 * @public
 */
export interface SurfaceTypeAnnotations {
  /** Imported type names, e.g. `['PortableTextComponents']`. */
  names: readonly string[]
  /** Module specifiers the type names must be imported from. */
  sources: readonly string[]
}

/**
 * One allow-listed API surface. Anchors ({@link SurfaceCallees | callees} and/or
 * {@link SurfaceTypeAnnotations | typeAnnotations}) locate the surface objects; `paths` and
 * `hookProps` decide which function-valued properties within them are annotated.
 * @public
 */
export interface Surface {
  /** A short identifier for diagnostics. */
  name: string
  /** Call-expression anchors for this surface. */
  callees?: SurfaceCallees
  /** Type-annotation anchors for this surface. */
  typeAnnotations?: SurfaceTypeAnnotations
  /**
   * Dot-separated property-key path patterns, matched from the surface object's root to each
   * function-valued property. A `*` segment matches any key, and a leading `**.` matches any
   * (possibly empty) path prefix — so `'**.components.input'` matches `components.input` at the
   * root as well as `fields.components.input` behind a `fields` array. Array elements are
   * transparent (they consume no path segment).
   */
  paths?: readonly string[]
  /**
   * Also annotate any function-valued property whose key follows the React hook naming
   * convention (`use[A-Z0-9]…`), anywhere under the surface object — including inside the
   * arguments of nested calls (e.g. plugin factories like
   * `plugins: [assist({fieldActions: {useFieldActions: …}})]`).
   */
  hookProps?: boolean
}

/**
 * Sanity Studio configuration: `defineConfig(…)` / `definePlugin(…)` from `sanity`. Annotates
 * the component slots of `form.components` and `studio.components`, plus any `use*`-named
 * function props anywhere in the config (hook contracts like `useFieldActions`, including
 * inside plugin-factory arguments). Deliberately excludes `icon`, `document.actions`, and
 * `document.badges` — those are invoked as plain functions (or are hooks named like
 * components), so memo-cache calls injected into them would not be render-scoped.
 * @public
 */
export const sanityConfigSurface: Surface = {
  name: 'sanity-config',
  callees: {names: ['defineConfig', 'definePlugin'], sources: ['sanity']},
  paths: ['form.components.*', 'studio.components.*'],
  hookProps: true,
}

/**
 * Sanity schema types: `defineType(…)` / `defineField(…)` / `defineArrayMember(…)` from
 * `sanity` (or `@sanity/types`). Annotates the render-invoked `components.*` slots at any
 * nesting depth (fields declared inline, without their own `defineField` wrapper, sit behind a
 * `fields`/`of` array). Deliberately excludes `icon`: schema icons are commonly invoked as
 * plain calls (e.g. `renderToStaticMarkup(type.icon())`), outside any render scope.
 * @public
 */
export const sanitySchemaSurface: Surface = {
  name: 'sanity-schema',
  callees: {
    names: ['defineType', 'defineField', 'defineArrayMember'],
    sources: ['sanity', '@sanity/types'],
  },
  paths: [
    '**.components.input',
    '**.components.field',
    '**.components.item',
    '**.components.preview',
    '**.components.block',
    '**.components.inlineBlock',
    '**.components.annotation',
    '**.components.diff',
  ],
}

/**
 * `@portabletext/react` component maps: object literals annotated with the
 * `PortableTextComponents` / `PortableTextReactComponents` types (via `: T`, `satisfies T`, or
 * `as T`). Every function-valued member of those types is a component rendered by
 * `<PortableText>` (top-level slots like `hardBreak`, and the members of `types`, `marks`,
 * `block`, `list`, and `listItem`), so the whole shape is annotated to a depth of two.
 * @public
 */
export const portableTextSurface: Surface = {
  name: 'portabletext',
  typeAnnotations: {
    names: ['PortableTextComponents', 'PortableTextReactComponents'],
    sources: ['@portabletext/react'],
  },
  paths: ['*', '*.*'],
}

/**
 * The built-in surfaces annotated by default: {@link sanityConfigSurface},
 * {@link sanitySchemaSurface}, and {@link portableTextSurface}.
 * @public
 */
export const defaultSurfaces: readonly Surface[] = [
  sanityConfigSurface,
  sanitySchemaSurface,
  portableTextSurface,
]
