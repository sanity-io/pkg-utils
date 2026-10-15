---
'@sanity/pandacss-tsdown-plugin': minor
---

Add `removeCascadeLayers()`, exported from the new `@sanity/pandacss-tsdown-plugin/vite` entry: the Vite counterpart of `cascadeLayers: false`, for packages that build with the plugin and also run their Panda sources through the official `@pandacss/vite` plugin, in a dev server, a Storybook or Vitest's browser mode. Registered next to `@pandacss/vite` with the names of the Panda config's layers (`removeCascadeLayers(['reset', 'base', 'tokens', 'recipes', 'utilities'])`), it removes those layers from the CSS `@pandacss/vite` generates with the same pass as the build, so that output cascades like the published `bundle.css`, and leaves every other layer alone. `vite` is an optional peer dependency, which only the new entry needs.
