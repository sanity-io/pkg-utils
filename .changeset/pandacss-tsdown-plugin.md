---
'@sanity/pandacss-tsdown-plugin': minor
'@sanity/tsdown-config': minor
---

Add `@sanity/pandacss-tsdown-plugin` and the `panda` option in `@sanity/tsdown-config` for building Panda CSS libraries with tsdown: depends directly on `@pandacss/compiler` and `@pandacss/transformer` (with `@pandacss/dev` as an optional `*` peer), runs Panda codegen at build start and on watch-mode config reloads, derives `transform.filter.id` from `panda.config.ts` `include`/`exclude` globs, rewrites style calls at build time by default (`transform: true`, unlike `@pandacss/vite`; set `transform: false` to opt out), extracts all Panda cascade layers with `emitLayerDeclaration: false`, strips `--made-with-panda` and lowers CSS syntax via `lightningcss`, and supports `inject`, `exports.nodeCompat`, `target`, and `minify`.
