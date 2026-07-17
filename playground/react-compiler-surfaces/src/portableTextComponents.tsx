import type {PortableTextComponents} from '@portabletext/react'

/**
 * Object-property components React Compiler's `infer` mode never compiles on its own — the
 * `babel.reactCompilerSurfaces` option annotates them with `'use memo'` so the compiler
 * memoizes them in place.
 * @public
 */
export const portableTextComponents: PortableTextComponents = {
  types: {
    image: ({value}) => <img src={(value as {imageUrl?: string}).imageUrl} />,
  },
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
