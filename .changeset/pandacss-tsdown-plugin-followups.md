---
'@sanity/pandacss-tsdown-plugin': patch
---

Fix several cases where styles were missed or the build output was wrong:

- Entries that only use patterns, config recipes or `token()` now get the stylesheet import with `transform: false`, and a watch rebuild drops the import again once a module stops using Panda.
- Panda now transforms modules before the other plugins' transforms (such as a React Compiler), so it reads the authored source: Panda JSX keeps its styles even when another plugin lowers JSX.
- With tsdown, the generated `styled-system` files are written after tsdown's `clean` step, so `clean` may list them, and again for every `build()` that reuses the plugin.
- The `outdir` option now also applies to Panda's default import map, so calls imported from that directory are extracted, also after a config reload in watch mode.
- `target` accepts tsdown's `'baseline-widely-available'` alias, like `css.target` in `@tsdown/css`.
- A symlinked project directory, a relative `cwd` and `include` globs with `..` segments no longer leave modules untransformed.
- `fileName` accepts a `./` prefix and dot-prefixed names, and a name outside the output directory is rejected.
- With `exports`, an output directory outside the package fails with an explanation instead of writing an invalid export, and an entry your own `customExports` writes for the stylesheet is kept, also when it changes the map in place.
- Watch mode keeps a Windows network-share (UNC) output directory out of the watcher.
