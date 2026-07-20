import type {Plugin} from 'rolldown'
import {annotateReactCompilerSurfaces} from './annotate.ts'
import {excludeIdFilter, surfaceAnchorPattern, transformIdFilter} from './filters.ts'
import {defaultSurfaces, type Surface} from './surfaces.ts'

export {annotateReactCompilerSurfaces} from './annotate.ts'
export type {AnnotateOptions, AnnotateResult, EstreeProgram} from './annotate.ts'
export {excludeIdFilter, surfaceAnchorPattern, transformIdFilter} from './filters.ts'
export {
  defaultSurfaces,
  portableTextSurface,
  sanityConfigSurface,
  sanitySchemaSurface,
} from './surfaces.ts'
export type {Surface, SurfaceCallees, SurfaceTypeAnnotations} from './surfaces.ts'

/**
 * Options for {@link reactCompilerSurfacesPlugin}.
 * @public
 */
export interface Options {
  /**
   * The API surfaces to annotate.
   * @defaultValue the built-in Sanity + PortableText surfaces (`defaultSurfaces`)
   */
  surfaces?: readonly Surface[]
  /**
   * Module ids to consider.
   * @defaultValue JS/TS sources (`.js`, `.jsx`, `.ts`, `.tsx` and their `m`/`c` flavors)
   */
  include?: RegExp
  /**
   * Module ids to skip.
   * @defaultValue `node_modules` and virtual modules
   */
  exclude?: RegExp
}

/**
 * The plugin object returned by {@link reactCompilerSurfacesPlugin}: a rolldown plugin with
 * the Vite-only `enforce: 'pre'` marker on top, so the same object drops into Vite (where the
 * marker orders it before `@vitejs/plugin-react` and any babel pass) — rolldown and tsdown
 * ignore the extra property and order plugins by their position in the `plugins` array.
 * @public
 */
export type ReactCompilerSurfacesPlugin = Plugin & {enforce: 'pre'}

/**
 * A rolldown plugin that injects `'use memo'` React Compiler opt-in directives into the
 * function-valued properties of allow-listed Sanity API surfaces (`defineConfig` /
 * `defineType` component slots, `use*` hook props, PortableText component maps), so a
 * downstream `babel-plugin-react-compiler` pass memoizes components and hooks its `infer`
 * mode never sees.
 *
 * The transform only *annotates* — it runs completely independently of the React Compiler
 * pipeline, with one rule: it must run **before** the compiler's babel pass, so the compiler
 * sees (and acts on) the injected directives. In rolldown/tsdown that means placing it
 * earlier in the `plugins` array than the compiler's babel plugin; in Vite the plugin's
 * `enforce: 'pre'` handles the ordering. Without a compiler pass downstream the injected
 * directives are inert strings.
 *
 * The `transform` hook declares `id` and `code` filters, so rolldown skips the Rust ↔ JS
 * roundtrip for modules that cannot contain an anchor.
 * @public
 */
export function reactCompilerSurfacesPlugin(options: Options = {}): ReactCompilerSurfacesPlugin {
  const surfaces = options.surfaces ?? defaultSurfaces
  const include = options.include ?? transformIdFilter
  const exclude = options.exclude ?? excludeIdFilter

  return {
    name: 'sanity-react-compiler-surfaces',
    enforce: 'pre',

    transform: {
      filter: {
        id: {include, exclude},
        code: surfaceAnchorPattern(surfaces),
      },
      async handler(code, id) {
        const [filePath = id] = id.split('?')
        const result = await annotateReactCompilerSurfaces(code, {filename: filePath, surfaces})
        if (!result) return undefined
        return {code: result.code, map: result.map}
      },
    },
  }
}
