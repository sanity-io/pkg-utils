---
'@sanity/pkg-utils': patch
'@sanity/tsdown-config': patch
'@sanity/vanilla-extract-tsdown-plugin': patch
---

Align every rolldown copy on the version vite 8 pins (`1.1.5`, via a pnpm override and `~1.1.5`/`1.1.5` ranges) so vite, tsdown, rolldown-plugin-dts, and the workspace packages all share one copy — and one `Plugin` type, making the cross-version `@ts-expect-error` suppressions from #3051 unnecessary. To be bumped when vite updates its pinned rolldown.
