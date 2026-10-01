---
'@sanity/vanilla-extract-vite-plugin': patch
---

Fix stale CSS in Vite's bundled dev mode (`experimental.bundledDev`, e.g. `sanity dev` with `unstable_bundledDev`). Editing a `.css.ts` file, or a module it imports, now hot-updates its styles. Previously the dev server kept serving the CSS it compiled at startup, through HMR and full page reloads alike, until it was restarted.

- The compiler no longer inherits `experimental.bundledDev`. In that mode Vite's file watcher skips the project root, so the compiler never saw an edit.
- The virtual `.vanilla.css` modules register their `.css.ts` file and its dependencies as watch files. Bundled dev mode never calls `hotUpdate`, and Rolldown's dev engine only re-loads a module whose own file or watch files changed.
- A new `watchChange` hook invalidates the compiler before Rolldown re-runs `load` and `transform`, so the re-run can't read results cached before the edit. It calls the new `Compiler.invalidateFile` method.
