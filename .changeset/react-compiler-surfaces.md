---
'@sanity/react-compiler-integration': minor
'@sanity/react-compiler-rolldown-plugin': minor
'@sanity/react-compiler-tsdown-plugin': minor
'@sanity/react-compiler-vite-plugin': minor
'@sanity/tsdown-config': minor
'@sanity/pkg-utils': minor
---

Add the React Compiler surfaces plugin family: allow-listed Sanity API surfaces
(`defineConfig`/`defineType` component slots, `use*` hook props, PortableText component maps)
are opted into React Compiler memoization with injected `'use memo'` directives, so the
object-property components and hooks the compiler's `infer` mode never sees get memoized too.
Enable it with the new `reactCompilerSurfaces` option in `@sanity/tsdown-config`, the new
`babel.reactCompilerSurfaces` option in `@sanity/pkg-utils`, or the standalone
rolldown/vite/tsdown plugins (`@sanity/react-compiler-vite-plugin` slots into `sanity.cli.ts`
via the `vite` override, next to the CLI's `reactCompiler` option).
