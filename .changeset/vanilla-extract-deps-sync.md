---
"@sanity/vanilla-extract-integration": patch
"@sanity/vanilla-extract-rolldown-plugin": patch
"@sanity/vanilla-extract-tsdown-plugin": patch
"@sanity/vanilla-extract-vite-plugin": patch
---

Bump `@vanilla-extract/css` to `^1.21.2` (debug identifiers replace dots with underscores) and `@vanilla-extract/vite-plugin` comparison baselines to `^5.2.6`.

Also port the upstream vite-plugin virtual-CSS cache-miss fix ([vanilla-extract#1776](https://github.com/vanilla-extract-css/vanilla-extract/pull/1776)): when Vite serves a `.vanilla.css` module without re-running the parent `.css.ts` transform (e.g. 304 Not Modified after a server restart with a warm browser cache), the plugin now processes the parent on demand instead of failing to resolve/load the virtual CSS.
