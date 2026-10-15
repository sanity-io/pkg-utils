---
'@sanity/tsdown-config': minor
---

Add the `panda` option for packages styled with [Panda CSS](https://panda-css.com). Set `panda: true` to enable `@sanity/pandacss-tsdown-plugin` with the Sanity defaults, or pass an options object to customize it.

By default:

- the style calls that can be resolved statically are rewritten into class names, and the generated CSS is extracted into `dist/bundle.css`
- the entry chunks that use Panda styles import the stylesheet
- the stylesheet is published as a conditional `./bundle.css` export: the `browser` and `style` conditions select the CSS file, `node` and `default` a no-op JS shim, so the import also loads in Node.js

The CSS syntax is transformed for the configured browsers — `panda.target`, falling back to the top-level `target`. When neither names browsers (for example `node20`), the browsers of `@sanity/browserslist-config` are used instead.

Minification is opt-in:

```ts
export default defineConfig({
  panda: {minify: true},
})
```

Setup: install `@sanity/pandacss-tsdown-plugin` as a dev dependency; it is an optional peer dependency of this package. `@pandacss/dev` is recommended — for the usual `"prepare": "panda codegen"` script and the `panda` CLI — but not required.
