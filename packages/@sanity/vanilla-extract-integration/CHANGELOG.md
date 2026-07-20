# @sanity/vanilla-extract-integration

## 0.1.5

### Patch Changes

- [#3106](https://github.com/sanity-io/pkg-utils/pull/3106) [`f180e02`](https://github.com/sanity-io/pkg-utils/commit/f180e022908ad555756e013b20cb589a34703954) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Update `lightningcss` to `^1.33.0` and `yuku-parser` to `^0.7.0`.

## 0.1.4

### Patch Changes

- [#3096](https://github.com/sanity-io/pkg-utils/pull/3096) [`aac3364`](https://github.com/sanity-io/pkg-utils/commit/aac3364216b6c0f3d361d4068da0224c3335ab0f) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.12

## 0.1.3

### Patch Changes

- [#3089](https://github.com/sanity-io/pkg-utils/pull/3089) [`412881b`](https://github.com/sanity-io/pkg-utils/commit/412881b552f8c5315c12d961da903b4836581646) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.11

## 0.1.2

### Patch Changes

- [#3083](https://github.com/sanity-io/pkg-utils/pull/3083) [`102d159`](https://github.com/sanity-io/pkg-utils/commit/102d159b0710363a37176560a1cc3d5b70f651cf) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency yuku-parser to ^0.6.5

## 0.1.1

### Patch Changes

- [#3066](https://github.com/sanity-io/pkg-utils/pull/3066) [`691f5f8`](https://github.com/sanity-io/pkg-utils/commit/691f5f8d2072c6b1f9effd2243cf38c20b66ba6f) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency yuku-parser to ^0.6.4

- [#3077](https://github.com/sanity-io/pkg-utils/pull/3077) [`9ec6ff3`](https://github.com/sanity-io/pkg-utils/commit/9ec6ff3c27fb26da8265cbd3733a0260ee833baa) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.9

## 0.1.0

### Minor Changes

- [#3058](https://github.com/sanity-io/pkg-utils/pull/3058) [`685f9c6`](https://github.com/sanity-io/pkg-utils/commit/685f9c6015ba69c9efcb201745a395bf663088b4) Thanks [@stipsan](https://github.com/stipsan)! - Vendor `@vanilla-extract/integration` onto the rolldown toolchain as `@sanity/vanilla-extract-integration`, and consume it from both plugins. The `compile()` child compilation of `.css.ts` graphs now runs on rolldown instead of esbuild (making library builds with the rolldown/tsdown plugin ~1.5x faster on the benchmark suite), debug IDs are injected by an offset-splicing AST pass over `yuku-parser`'s oxc-shaped AST instead of `@vanilla-extract/babel-plugin-debug-ids` (yuku parsed ~2x faster than `rolldown/parseAst` in the reproducible corpus bench-off, and the yuku toolchain is already transitive via rolldown-plugin-dts), and the `eval`, `find-up`, `dedent`, and `mlly` dependencies are replaced with `node:vm` and inlined equivalents — dropping `@babel/core`, `esbuild`, and their subtrees from the plugins' production dependency graphs entirely.

### Patch Changes

- [#3045](https://github.com/sanity-io/pkg-utils/pull/3045) [`3020923`](https://github.com/sanity-io/pkg-utils/commit/30209234b7b8ce6bbb5a3895747d1522d5ee2605) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency rolldown to v1.2.0
