import {
  reactCompilerSurfacesPlugin as rolldownReactCompilerSurfacesPlugin,
  type Options,
} from '@sanity/react-compiler-rolldown-plugin'
import type {TsdownPlugin} from 'tsdown'

export {
  defaultSurfaces,
  portableTextSurface,
  sanityConfigSurface,
  sanitySchemaSurface,
} from '@sanity/react-compiler-rolldown-plugin'
export type {
  Options,
  Surface,
  SurfaceCallees,
  SurfaceTypeAnnotations,
} from '@sanity/react-compiler-rolldown-plugin'

/**
 * A tsdown plugin that injects `'use memo'` React Compiler opt-in directives into the
 * function-valued properties of allow-listed Sanity API surfaces (`defineConfig` /
 * `defineType` component slots, `use*` hook props, PortableText component maps), so the React
 * Compiler's babel pass memoizes components and hooks its `infer` mode never sees.
 *
 * It re-exports the rolldown-generic
 * [`@sanity/react-compiler-rolldown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/react-compiler-rolldown-plugin#readme)
 * typed for tsdown's plugin option. Place it **before** the React Compiler's babel plugin —
 * `@sanity/tsdown-config` does this automatically through its `reactCompilerSurfaces` option.
 * @public
 */
export function reactCompilerSurfacesPlugin(options: Options = {}): TsdownPlugin {
  return {...rolldownReactCompilerSurfacesPlugin(options)}
}
