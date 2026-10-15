---
'@sanity/tsdown-config': minor
---

Enable `transpileTemplateLiterals` by default in the `styledComponents` transform, matching the `@sanity/pkg-utils` default.

Tagged template literals like `` styled.button`...` `` are now transpiled to plain call expressions (`styled.button(["..."])`) in the build output, the same shape `babel: {styledComponents: true}` in `@sanity/pkg-utils` produces. Pure annotations are only defined for plain call expressions, not tagged template expressions (see [rollup#4035](https://github.com/rollup/rollup/issues/4035)), so this shape is a prerequisite for tree-shaking unused styled components. Note that oxc doesn't yet add the `/*#__PURE__*/` annotation to the transpiled call expression itself (it only annotates initializers that are already plain call expressions in the source), so unused styled components aren't dropped yet until that's supported upstream.

To restore the previous output, set `styledComponents: {transpileTemplateLiterals: false}` in `tsdown.config.ts`.
