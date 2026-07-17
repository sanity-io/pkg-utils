import type {Plugin} from 'rollup'
import type {ReactCompilerSurfacesOptions} from '../../core/config/types.ts'

/**
 * A rollup plugin that injects `'use memo'` React Compiler opt-in directives into the
 * function-valued properties of allow-listed Sanity API surfaces (`defineConfig` /
 * `defineType` component slots, `use*` hook props, PortableText component maps), through
 * `@sanity/react-compiler-integration`. It must run before the `babel()` plugin that applies
 * `babel-plugin-react-compiler`, so the compiler sees (and acts on) the injected directives.
 */
export function reactCompilerSurfaces(options: ReactCompilerSurfacesOptions = {}): Plugin {
  return {
    name: 'pkg-utils/react-compiler-surfaces',
    async transform(code, id) {
      // Lazy loaded so the annotation toolchain is only paid for when the option is enabled
      const {annotateReactCompilerSurfaces, excludeIdFilter, transformIdFilter} =
        await import('@sanity/react-compiler-integration')
      if (!transformIdFilter.test(id) || excludeIdFilter.test(id)) return null
      const [filePath = id] = id.split('?')
      const result = await annotateReactCompilerSurfaces(code, {
        ...options,
        filename: filePath,
      })
      if (!result) return null
      return {code: result.code, map: result.map}
    },
  }
}
