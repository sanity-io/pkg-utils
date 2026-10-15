---
'@sanity/pandacss-tsdown-plugin': minor
---

Add the `@sanity/pandacss-tsdown-plugin/vite` entry, for apps, Storybooks and Vitest browser suites that build Panda sources with Vite. Its `pandacss()` wraps the official `@pandacss/vite` plugin and provides the stylesheet that plugin generates the CSS into as `virtual:panda.css`, which declares the layers of the Panda config, so an app imports it instead of hand-writing a stylesheet with the `@layer` statement. With `cascadeLayers: false`, it removes the cascade layers from that stylesheet with the same pass as the tsdown plugin's `cascadeLayers: false`, so the app cascades like the `bundle.css` a library publishes with it, in `vite dev`, `vite build` and Vitest's browser mode. A `banner` option prepends CSS such as a `@layer` statement that orders other libraries' layers. `vite` and `@pandacss/vite` are optional peer dependencies, which only the new entry needs.
