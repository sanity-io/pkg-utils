---
"@sanity/parse-package-json": minor
"@sanity/pkg-utils": minor
---

feat: support conditional `exports` for CSS files

CSS subpath exports may now be declared as a conditional object (a flat map of condition name to path) instead of only a plain string. This enables re-adding a `import "<pkg>/bundle.css"` statement that resolves to the real CSS file in bundler/browser environments, while resolving to a no-op JS shim in runtimes (like Node) that cannot import `.css` files directly:

```json
{
  "exports": {
    "./bundle.css": {
      "browser": "./dist/bundle.css",
      "style": "./dist/bundle.css",
      "node": "./dist/bundle.css.js",
      "default": "./dist/bundle.css.js"
    }
  }
}
```
