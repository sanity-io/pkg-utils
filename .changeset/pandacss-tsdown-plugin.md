---
'@sanity/pandacss-tsdown-plugin': minor
---

Add `@sanity/pandacss-tsdown-plugin`, a tsdown plugin for publishing Panda CSS libraries with a pre-extracted stylesheet. Use it in `tsdown.config.ts` for library builds while applications continue using `@pandacss/vite`.

### Capabilities

- Runs Panda codegen at build start and when the Panda config reloads in watch mode so generated `styled-system` types and runtime files stay aligned with `panda.config.ts`.
- Transforms statically resolvable Panda style calls into atomic class name strings by default (`transform: true`). Calls that cannot be resolved statically keep their `styled-system` runtime imports.
- Extracts all Panda cascade layers into a single Lightning CSS-optimized stylesheet (`styles.css` by default).
- Supports browser syntax targeting (`target`), optional minification (`minify: true`), entry-chunk CSS import injection (`inject`), and Node-compatible conditional package exports (`exports: {nodeCompat: true}`).

### Setup

Install `tsdown` and `@sanity/pandacss-tsdown-plugin` (`@pandacss/compiler` and `@pandacss/transformer` are direct dependencies). Installing `@pandacss/dev` (an optional peer dependency) is recommended for a `"prepare": "panda codegen"` script and CLI debugging commands.
