---
'@sanity/pandacss-tsdown-plugin': patch
---

Fix several cases where styles were missed or the build output was wrong:

- Entries that only use patterns, config recipes or `token()` now get the stylesheet import with `transform: false`, and a watch rebuild drops the import again once a module stops using Panda.
- Panda now transforms modules before the other plugins' transforms (such as a React Compiler), so it reads the authored source: Panda JSX keeps its styles even when another plugin lowers JSX.
- With tsdown, the generated `styled-system` files are written after tsdown's `clean` step, so `clean` may list them, and again for every `build()` that reuses the plugin.
- The `outdir` option now also applies to Panda's default import map, so calls imported from that directory are extracted, also after a config reload in watch mode. The config it loads goes through a private temporary directory that only exists while Panda loads it, and builds that share the plugin and reload at the same time share one reload.
- `target` accepts tsdown's `'baseline-widely-available'` alias, like `css.target` in `@tsdown/css`.
- A symlinked project directory (also with rolldown's `resolve.symlinks: false`), a relative `cwd` and `include` globs with `..` segments no longer leave modules untransformed.
- `fileName` accepts a `./` prefix and dot-prefixed names, and a name outside the output directory is rejected.
- With `exports`, an output directory outside the package fails with an explanation instead of writing an invalid export, and your own `customExports` now runs after the stylesheet export is added, so an entry it writes for the stylesheet wins.
- Watch mode keeps a Windows network-share (UNC) output directory out of the watcher.
