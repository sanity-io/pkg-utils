---
"@sanity/pkg-utils": minor
---

feat: auto-wire the conditional `bundle.css` export for vanilla-extract

When `rollup.vanillaExtract` is enabled, pkg-utils now (by default) bakes in the conditional CSS export pattern so userland no longer needs a manual `rollup.output.intro` + shim plugin + `package.json` export. This new "compat mode" (`rollup.vanillaExtract.extract.compatMode`, defaults to `true`):

- injects the self-referential `import "<pkg-name>/<name>"` into each entry chunk,
- emits a no-op `<name>.js` shim for runtimes that cannot import `.css` files, and
- writes the conditional `"./<name>"` export to `package.json` (`browser`/`style` → the real CSS, `node`/`default` → the shim).

The emitted CSS file name is configurable via `rollup.vanillaExtract.extract.name` (default `"bundle.css"`), and the `vanillaExtract` option is now fully typed (`PkgVanillaExtractOptions`) with its real defaults documented. Set `extract.compatMode: false` to opt out and wire these up yourself.
