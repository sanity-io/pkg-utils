import type {PortableTextComponents} from '@portabletext/react'

/**
 * Object-property components React Compiler's `infer` mode never compiles on its own — the
 * `reactCompilerSurfaces` option annotates them with `'use memo'` so the compiler memoizes
 * them in place.
 */
export const portableTextComponents: PortableTextComponents = {
  marks: {
    link: ({children, value}) => {
      const rel = !value?.href.startsWith('/') ? 'noreferrer noopener' : undefined
      return (
        <a href={value?.href} rel={rel}>
          {children}
        </a>
      )
    },
  },
}
