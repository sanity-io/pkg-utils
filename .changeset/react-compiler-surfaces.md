---
'@sanity/react-compiler-rolldown-plugin': minor
---

Add `@sanity/react-compiler-rolldown-plugin`: allow-listed Sanity API surfaces
(`defineConfig`/`defineType` component slots, `use*` hook props, PortableText component maps)
are opted into React Compiler memoization with injected `'use memo'` directives, so the
object-property components and hooks the compiler's `infer` mode never sees get memoized too.
The plugin only annotates, so it runs independently of the compiler pipeline — the one rule is
that it must run before the compiler's babel pass. One package covers rolldown, tsdown, and
Vite (including Sanity Studio through the `vite` override in `sanity.cli.ts`, next to the
CLI's `reactCompiler` option).
