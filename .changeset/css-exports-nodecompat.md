---
'@sanity/vanilla-extract-rolldown-plugin': minor
'@sanity/vanilla-extract-tsdown-plugin': minor
'@sanity/parse-package-json': minor
'@sanity/tsdown-config': minor
'@sanity/pkg-utils': minor
---

Move the conditional CSS export from `inject.nodeCompat` to `exports.nodeCompat`, and give `@tsdown/css` output the same treatment.

`nodeCompat` configures how the CSS file is published, not how the import is injected, so it moves to a dedicated `exports` option. `inject` and `exports` are now independent: `inject` prepends an import of the CSS to entry chunks, while `exports` publishes it as the `./<fileName>` export subpath (which also makes any injected import self-referential). `exports: true` declares a plain string export for browser-only packages; `exports: {nodeCompat: true}` declares the conditional export and emits the no-op JS shim plus its `.d.ts`. `inject: {nodeCompat: true}` keeps working, normalized to `{inject: true, exports: {nodeCompat: true}}` with a deprecation warning; an explicit `exports` wins over it.

`@sanity/tsdown-config` gains a `css.exports` option implementing the same pattern on top of `@tsdown/css` (an optional peer dependency), which compiles CSS but has no node-shim concept of its own — its `inject` emits a relative import that throws in runtimes that cannot load `.css` files.

`@sanity/pkg-utils` gains a `css` option, and builds a `.css` export subpath that declares a `source`:

```json
"./ui/styles.css": {"source": "./src/ui/styles.css"}
```

`pkg build` compiles it to `dist/ui/styles.css` with the same minify and lowering settings `vanillaExtract` gets, emits the shim, and fills in the `types`/`browser`/`style`/`node`/`default` conditions. `@sanity/parse-package-json` exposes the new `parseCssExports` for reading those subpaths, and `parseExports` no longer returns them as JS entries.
