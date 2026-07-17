import {
  annotateReactCompilerSurfaces,
  defaultSurfaces,
  excludeIdFilter,
  surfaceAnchorPattern,
  transformIdFilter,
  type Surface,
} from '@sanity/react-compiler-integration'
import type {Plugin} from 'vite'

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
 * A Vite plugin that injects `'use memo'` React Compiler opt-in directives into the
 * function-valued properties of allow-listed Sanity API surfaces (`defineConfig` /
 * `defineType` component slots, `use*` hook props, PortableText component maps), so the React
 * Compiler's babel pass memoizes components and hooks its `infer` mode never sees — see
 * `@sanity/react-compiler-integration` for the transform, the built-in surfaces, and the
 * safety model.
 *
 * The plugin is `enforce: 'pre'`, so it runs before `@vitejs/plugin-react` (and any other
 * babel pass) in both dev and build. It only *annotates* — the React Compiler itself must be
 * enabled separately (in a Sanity Studio: `reactCompiler: {target: '19'}` in `sanity.cli.ts`).
 * @public
 */
export function reactCompilerSurfacesPlugin(options: Options = {}): Plugin {
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
