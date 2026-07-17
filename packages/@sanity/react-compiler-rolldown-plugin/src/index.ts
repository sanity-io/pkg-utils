import {
  annotateReactCompilerSurfaces,
  defaultSurfaces,
  excludeIdFilter,
  surfaceAnchorPattern,
  transformIdFilter,
  type Surface,
} from '@sanity/react-compiler-integration'
import type {Plugin} from 'rolldown'

export {
  defaultSurfaces,
  portableTextSurface,
  sanityConfigSurface,
  sanitySchemaSurface,
} from '@sanity/react-compiler-integration'
export type {
  Surface,
  SurfaceCallees,
  SurfaceTypeAnnotations,
} from '@sanity/react-compiler-integration'

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
 * A rolldown plugin that injects `'use memo'` React Compiler opt-in directives into the
 * function-valued properties of allow-listed Sanity API surfaces (`defineConfig` /
 * `defineType` component slots, `use*` hook props, PortableText component maps), so a
 * downstream `babel-plugin-react-compiler` pass memoizes components and hooks its `infer`
 * mode never sees — see `@sanity/react-compiler-integration` for the transform, the built-in
 * surfaces, and the safety model.
 *
 * Place it **before** the React Compiler's babel plugin in the pipeline (e.g. before
 * `@rolldown/plugin-babel` with the `reactCompilerPreset`). The `transform` hook declares
 * `id` and `code` filters, so rolldown skips the Rust ↔ JS roundtrip for modules that cannot
 * contain an anchor.
 * @public
 */
export function reactCompilerSurfacesPlugin(options: Options = {}): Plugin {
  const surfaces = options.surfaces ?? defaultSurfaces
  const include = options.include ?? transformIdFilter
  const exclude = options.exclude ?? excludeIdFilter

  return {
    name: 'sanity-react-compiler-surfaces',

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
