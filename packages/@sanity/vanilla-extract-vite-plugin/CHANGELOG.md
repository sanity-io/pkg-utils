# @sanity/vanilla-extract-vite-plugin

## 0.2.0

### Minor Changes

- [#3058](https://github.com/sanity-io/pkg-utils/pull/3058) [`685f9c6`](https://github.com/sanity-io/pkg-utils/commit/685f9c6015ba69c9efcb201745a395bf663088b4) Thanks [@stipsan](https://github.com/stipsan)! - Vendor `@vanilla-extract/integration` onto the rolldown toolchain as `@sanity/vanilla-extract-integration`, and consume it from both plugins. The `compile()` child compilation of `.css.ts` graphs now runs on rolldown instead of esbuild (making library builds with the rolldown/tsdown plugin ~1.5x faster on the benchmark suite), debug IDs are injected by an offset-splicing AST pass over `yuku-parser`'s oxc-shaped AST instead of `@vanilla-extract/babel-plugin-debug-ids` (yuku parsed ~2x faster than `rolldown/parseAst` in the reproducible corpus bench-off, and the yuku toolchain is already transitive via rolldown-plugin-dts), and the `eval`, `find-up`, `dedent`, and `mlly` dependencies are replaced with `node:vm` and inlined equivalents — dropping `@babel/core`, `esbuild`, and their subtrees from the plugins' production dependency graphs entirely.

### Patch Changes

- Updated dependencies [[`3020923`](https://github.com/sanity-io/pkg-utils/commit/30209234b7b8ce6bbb5a3895747d1522d5ee2605), [`685f9c6`](https://github.com/sanity-io/pkg-utils/commit/685f9c6015ba69c9efcb201745a395bf663088b4)]:
  - @sanity/vanilla-extract-integration@0.1.0

## 0.1.1

### Patch Changes

- [#3046](https://github.com/sanity-io/pkg-utils/pull/3046) [`bfd86fa`](https://github.com/sanity-io/pkg-utils/commit/bfd86fa8bcd52ed01bfc0cd5302376f5ae09088d) Thanks [@stipsan](https://github.com/stipsan)! - fix(deps): update dependency rolldown to v1.2.0

  Also bumps `@vanilla-extract/vite-plugin` to `^5.2.5` in the benchmark/playground
  comparison baselines (already-latest `@vanilla-extract/css`, `integration`, and
  `rollup-plugin` left unchanged). Patch releases for the vanilla-extract plugins
  republish their READMEs, which link to the refreshed benchmark results.

## 0.1.0

### Minor Changes

- [#3032](https://github.com/sanity-io/pkg-utils/pull/3032) [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a) Thanks [@stipsan](https://github.com/stipsan)! - feat: initial release of `@sanity/vanilla-extract-vite-plugin`, a Vite 8 application plugin for vanilla-extract that compiles `.css.ts` modules and feeds their CSS into Vite's own CSS pipeline (PostCSS, code-splitting, HMR, SSR) as virtual `.vanilla.css` modules. Compared to `@vanilla-extract/vite-plugin` it declares plugin hook filters on its `transform`/`resolveId`/`load` hooks so rolldown-based Vite 8 skips the Rust ↔ JS roundtrip for unrelated modules ([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)), uses the environment-aware `hotUpdate` hook instead of the deprecated `handleHotUpdate`, and evaluates `.css.ts` modules through a caching compiler built on Vite's Environment API / `ModuleRunner` instead of the legacy `vite-node` — `.css.ts` modules are cached in the internal server's module graph and invalidated per file on change. Supports `identifiers`, a `pluginFilter` controlling which of the consumer's Vite plugins are forwarded to the compiler server (none by default — the filtering work is skipped entirely without a `pluginFilter`, and Vite 8's built-in `resolve.tsconfigPaths` replaces the `vite-tsconfig-paths` plugin upstream forwards, applying to the compiler server automatically through the forwarded config), and `mode: 'inlineCssInDev'` for FOUC-free dev SSR. The caching compiler is also exported as `createCompiler` for other Vite-based tooling.
