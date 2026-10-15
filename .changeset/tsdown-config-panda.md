---
'@sanity/tsdown-config': minor
---

Add the `panda` option to `defineConfig` for building Panda CSS libraries with `@sanity/pandacss-tsdown-plugin`. Enable it with `panda: true` or pass an options object to customize.

### Defaults

- Emits the extracted stylesheet to `dist/styles.css`, runs Panda codegen at build start, and transforms statically resolvable style calls into class name strings (`transform: true`).
- Prepends a self-referential `import "<pkg>/styles.css"` (or `require()` in CJS) to entry chunks that use Panda styles (`inject: true`).
- Publishes `"./styles.css"` in `package.json#exports` as a conditional export backed by a no-op `styles-css.js` shim for Node.js and `styles-css.d.ts` for TypeScript (`exports: {nodeCompat: true}`).
- Transforms CSS syntax for the configured browser `target`. When the effective target does not specify browsers (for example `node20` or when `target` is unset), targets fall back to `@sanity/browserslist-config`.
- Leaves CSS unminified by default. Pass `panda: {minify: true}` to minify the emitted stylesheet.

### Setup

Install `tsdown`, `@sanity/tsdown-config`, and `@sanity/pandacss-tsdown-plugin`. Installing `@pandacss/dev` is recommended for a `"prepare": "panda codegen"` script (so generated types exist for your IDE and TypeScript before a build) and for CLI commands such as validating `panda.config.ts`.
