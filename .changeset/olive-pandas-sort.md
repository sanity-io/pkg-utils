---
'@sanity/pkg-utils': minor
---

Enable `transpileTemplateLiterals` by default in the `babel.styledComponents` transform, so unused styled components can be tree-shaken.

The `pure: true` default has been emitting `/*#__PURE__*/` annotations in front of tagged template expressions, a position no bundler supports (see [rollup#4035](https://github.com/rollup/rollup/issues/4035)), so the annotations were dropped and unused styled components were never tree-shaken - not by pkg-utils itself, and not by the bundlers of apps consuming the published package. Transpiling `` styled.button`...` `` to `styled.button(["..."])` turns the styled component initializer into a plain call expression, which pure annotations are defined for:

```js
const UsedButton = /*#__PURE__*/ styled.button.withConfig({
  displayName: "UsedButton",
  componentId: "sc-1fal5wv-1"
})(["cursor:pointer;"]);
```

With this shape, unused styled components are now removed from the build output, and the annotation survives into the published output so app bundlers (rollup, webpack, esbuild, etc) can drop exported styled components that the app never imports.

To restore the previous output, set `babel: {styledComponents: {transpileTemplateLiterals: false}}` in `package.config.ts`.
