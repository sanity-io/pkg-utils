# @sanity/tsdown-config

## 0.19.6

### Patch Changes

- [#3106](https://github.com/sanity-io/pkg-utils/pull/3106) [`f180e02`](https://github.com/sanity-io/pkg-utils/commit/f180e022908ad555756e013b20cb589a34703954) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Update `lightningcss` to `^1.33.0` and `yuku-parser` to `^0.7.0`.

- Updated dependencies []:
  - @sanity/vanilla-extract-tsdown-plugin@0.2.8

## 0.19.5

### Patch Changes

- [#3096](https://github.com/sanity-io/pkg-utils/pull/3096) [`aac3364`](https://github.com/sanity-io/pkg-utils/commit/aac3364216b6c0f3d361d4068da0224c3335ab0f) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.12

- Updated dependencies [[`aac3364`](https://github.com/sanity-io/pkg-utils/commit/aac3364216b6c0f3d361d4068da0224c3335ab0f)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.2.7

## 0.19.4

### Patch Changes

- [#3089](https://github.com/sanity-io/pkg-utils/pull/3089) [`412881b`](https://github.com/sanity-io/pkg-utils/commit/412881b552f8c5315c12d961da903b4836581646) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.11

- [#3086](https://github.com/sanity-io/pkg-utils/pull/3086) [`b900be5`](https://github.com/sanity-io/pkg-utils/commit/b900be54f65dcfb4fabe2636b4a0380b01330209) Thanks [@stipsan](https://github.com/stipsan)! - Stop emitting a redundant `bundle.css.d.ts` alongside the vanilla-extract CSS shim.

  The conditional `./bundle.css` export already has an explicit `types` condition pointing at `bundle-css.d.ts`, so TypeScript never needs a sibling declaration for the CSS file itself. Compat mode now emits only that one declaration (plus `bundle-css.js` and `bundle.css`).

  `cssFileDtsFileName` is no longer exported from `@sanity/vanilla-extract-rolldown-plugin` (0.x breaking API change → minor).

- Updated dependencies [[`412881b`](https://github.com/sanity-io/pkg-utils/commit/412881b552f8c5315c12d961da903b4836581646), [`b900be5`](https://github.com/sanity-io/pkg-utils/commit/b900be54f65dcfb4fabe2636b4a0380b01330209)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.2.6

## 0.19.3

### Patch Changes

- Updated dependencies []:
  - @sanity/vanilla-extract-tsdown-plugin@0.2.5

## 0.19.2

### Patch Changes

- [#3077](https://github.com/sanity-io/pkg-utils/pull/3077) [`9ec6ff3`](https://github.com/sanity-io/pkg-utils/commit/9ec6ff3c27fb26da8265cbd3733a0260ee833baa) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.9

- Updated dependencies [[`9ec6ff3`](https://github.com/sanity-io/pkg-utils/commit/9ec6ff3c27fb26da8265cbd3733a0260ee833baa)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.2.4

## 0.19.1

### Patch Changes

- [#3058](https://github.com/sanity-io/pkg-utils/pull/3058) [`685f9c6`](https://github.com/sanity-io/pkg-utils/commit/685f9c6015ba69c9efcb201745a395bf663088b4) Thanks [@stipsan](https://github.com/stipsan)! - Align every rolldown copy on the version vite 8 pins (`1.1.5`, via a pnpm override and `~1.1.5`/`1.1.5` ranges) so vite, tsdown, rolldown-plugin-dts, and the workspace packages all share one copy — and one `Plugin` type, making the cross-version `@ts-expect-error` suppressions from [#3051](https://github.com/sanity-io/pkg-utils/issues/3051) unnecessary. To be bumped when vite updates its pinned rolldown.

- [#3045](https://github.com/sanity-io/pkg-utils/pull/3045) [`3020923`](https://github.com/sanity-io/pkg-utils/commit/30209234b7b8ce6bbb5a3895747d1522d5ee2605) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency rolldown to v1.2.0

- Updated dependencies [[`685f9c6`](https://github.com/sanity-io/pkg-utils/commit/685f9c6015ba69c9efcb201745a395bf663088b4), [`3020923`](https://github.com/sanity-io/pkg-utils/commit/30209234b7b8ce6bbb5a3895747d1522d5ee2605)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.2.3

## 0.19.0

### Minor Changes

- [#3059](https://github.com/sanity-io/pkg-utils/pull/3059) [`b328999`](https://github.com/sanity-io/pkg-utils/commit/b328999836df27ac878c1db8214163b70840cf9a) Thanks [@stipsan](https://github.com/stipsan)! - Enable Rolldown's `checks.circularDependency` warning by default (Rolldown itself defaults it to `false`), so import cycles surface during Sanity library builds. Override with `mergeConfig(..., {checks: {circularDependency: false}})` if needed.

- [#3050](https://github.com/sanity-io/pkg-utils/pull/3050) [`8aa451c`](https://github.com/sanity-io/pkg-utils/commit/8aa451c84675e9c57dc7238525449f48fc7dcf05) Thanks [@stipsan](https://github.com/stipsan)! - Expose tsdown's experimental `css` option on `PackageOptions` and forward it as-is (requires `@tsdown/css` in the project — this package does not depend on it). Safe to combine with `vanillaExtract` for packages that use both vanilla-extract and CSS modules; the pipelines write to `bundle.css` and `style.css` by default and do not collide.

## 0.18.0

### Minor Changes

- [#3048](https://github.com/sanity-io/pkg-utils/pull/3048) [`6824773`](https://github.com/sanity-io/pkg-utils/commit/682477382fd700b791210fe2b4feb0a151d7652c) Thanks [@stipsan](https://github.com/stipsan)! - Expose tsdown's `clean` option on `PackageOptions` so packages can clean folders before build (prefer `clean: ['dist', …]` over a separate `package.json` `"clean"` script) without `mergeConfig`

## 0.17.2

### Patch Changes

- Updated dependencies [[`bfd86fa`](https://github.com/sanity-io/pkg-utils/commit/bfd86fa8bcd52ed01bfc0cd5302376f5ae09088d)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.2.2

## 0.17.1

### Patch Changes

- [#3043](https://github.com/sanity-io/pkg-utils/pull/3043) [`f076033`](https://github.com/sanity-io/pkg-utils/commit/f076033a19737ed8e7d0a0e8395721e4a3d04f24) Thanks [@stipsan](https://github.com/stipsan)! - Rename the vanilla-extract node/SSR CSS shim from `bundle.css.js` to `bundle-css.js`, and add an explicit `types` condition to the conditional `./bundle.css` export.

  `bundle.css.js` matches vanilla-extract's `cssFileFilter` (`/\.css\.(js|…)$/`), so Vite plugins (notably `@sanity/vanilla-extract-vite-plugin` via Vite's `ModuleRunner`) would try to evaluate the empty shim as `.css.ts` output and throw. The public `./bundle.css` export subpath is unchanged; only the on-disk shim (and its `node`/`default` export targets) move to `bundle-css.js`, with matching `bundle-css.d.ts` / `bundle.css.d.ts` companions for both export targets.

  Since the shim's basename no longer matches the CSS file's basename, TypeScript's extension-substitution fallback (stripping `.js` to find a sibling `.d.ts`) would now resolve a different file than before - and that fallback is being deprecated in TypeScript itself (microsoft/TypeScript#50762). The conditional export now points a `types` condition directly at the shim's declaration file instead of relying on it:

  ```json
  "./bundle.css": {
    "types": "./dist/bundle-css.d.ts",
    "browser": "./dist/bundle.css",
    "style": "./dist/bundle.css",
    "node": "./dist/bundle-css.js",
    "default": "./dist/bundle-css.js"
  }
  ```

  Rebuilding a package with compat mode on rewrites `package.json` automatically.

- Updated dependencies [[`f076033`](https://github.com/sanity-io/pkg-utils/commit/f076033a19737ed8e7d0a0e8395721e4a3d04f24)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.2.1

## 0.17.0

### Minor Changes

- [#3032](https://github.com/sanity-io/pkg-utils/pull/3032) [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a) Thanks [@stipsan](https://github.com/stipsan)! - feat: CSS syntax lowering and minification now follow the `css` defaults of `@tsdown/css` exactly, and the `@sanity/browserslist-config` opinion moved up into `@sanity/tsdown-config`:

  - `@sanity/vanilla-extract-rolldown-plugin` (and the tsdown plugin wrapping it) no longer depends on `browserslist`/`@sanity/browserslist-config`. Like `css.target` in `@tsdown/css`, syntax lowering is skipped when no `target` is configured anywhere (the option, or the host-resolved top-level `target` — e.g. derived from `engines.node`), or when the configured targets name no browsers (e.g. `'node20'`); `target: false` stays the explicit off switch.
  - `minify` now defaults to `false`, matching `css.minify` in `@tsdown/css` (extracted CSS was previously minified by default).
  - New `lightningcss` option, like `css.lightningcss` in `@tsdown/css`: options passed through to lightningcss's `transform()`, where `lightningcss.targets` takes precedence over the esbuild-style `target` and the plugin-managed fields (`minify`, `cssModules`) win over their lightningcss counterparts. `esbuildTargetToLightningCSS` is exported for hosts that need to convert or inspect esbuild-style targets.
  - `@sanity/tsdown-config` preserves the Sanity-flavored defaults at its level (and now owns the `browserslist`, `@sanity/browserslist-config`, and `lightningcss` dependencies): when the effective CSS target (`vanillaExtract.target`, falling back to the top-level `target`) is undefined or names no browsers, the lowering targets are resolved from `@sanity/browserslist-config` and passed through `lightningcss.targets`. `target: false` (at either level) disables lowering entirely, and a user-provided `lightningcss.targets` wins over the fallback. `vanillaExtract.minify` keeps defaulting to `true` there — published Sanity libraries ship minified CSS, unlike the bare plugins — so nothing changes for `@sanity/tsdown-config` users.

### Patch Changes

- [#3032](https://github.com/sanity-io/pkg-utils/pull/3032) [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a) Thanks [@stipsan](https://github.com/stipsan)! - fix: use a literal `@` instead of the percent-encoded `%40` in the `homepage` links to the `packages/@sanity/*` directories, so the URLs read cleanly in the npm UI (GitHub resolves both forms)

- Updated dependencies [[`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a), [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.2.0

## 0.16.0

### Minor Changes

- [#3038](https://github.com/sanity-io/pkg-utils/pull/3038) [`97c95bc`](https://github.com/sanity-io/pkg-utils/commit/97c95bca88a0e2248896590beaad7af73547309a) Thanks [@stipsan](https://github.com/stipsan)! - Expose tsdown's `outDir` option on `PackageOptions` so packages can write to a non-`dist` directory without `mergeConfig`

## 0.15.0

### Minor Changes

- [#3031](https://github.com/sanity-io/pkg-utils/pull/3031) [`944ae4d`](https://github.com/sanity-io/pkg-utils/commit/944ae4d95d1cea3a64aeea1cb794bc5984befeed) Thanks [@stipsan](https://github.com/stipsan)! - Expose tsdown's `sourcemap` and `deps` options on `PackageOptions`, default `sourcemap` to `true` (matching `@sanity/pkg-utils`), and when `platform` is `'neutral'` mark `node:` built-ins external and restore `module`/`main` resolve fallbacks so monorepo wrappers no longer need `mergeConfig` for those

### Patch Changes

- [#3034](https://github.com/sanity-io/pkg-utils/pull/3034) [`86402fa`](https://github.com/sanity-io/pkg-utils/commit/86402fab7fe41dbc955cde8f47588cc9426a513c) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.8

- Updated dependencies [[`fb9ba79`](https://github.com/sanity-io/pkg-utils/commit/fb9ba79dfe6a2ef57d65758ed9d8167e419a3350), [`86402fa`](https://github.com/sanity-io/pkg-utils/commit/86402fab7fe41dbc955cde8f47588cc9426a513c)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.1.2

## 0.14.2

### Patch Changes

- [#3026](https://github.com/sanity-io/pkg-utils/pull/3026) [`04a6206`](https://github.com/sanity-io/pkg-utils/commit/04a62060a553e40d5d336b1b89e75f44d44bcf79) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.7

- Updated dependencies [[`04a6206`](https://github.com/sanity-io/pkg-utils/commit/04a62060a553e40d5d336b1b89e75f44d44bcf79)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.1.1

## 0.14.1

### Patch Changes

- [#3029](https://github.com/sanity-io/pkg-utils/pull/3029) [`b50944c`](https://github.com/sanity-io/pkg-utils/commit/b50944c3550fb8286f04a0e3b58c0f389f041d0f) Thanks [@stipsan](https://github.com/stipsan)! - Relax the `tsdown` peer dependency from an exact pin (`0.22.5`) to a range (`^0.22.5`), so newer `tsdown` patch releases like `0.22.7` no longer trigger unresolved peer dependency warnings on install.

- [#3027](https://github.com/sanity-io/pkg-utils/pull/3027) [`a16513b`](https://github.com/sanity-io/pkg-utils/commit/a16513b5f55839502a7585bfd6e0f141b22d8366) Thanks [@stipsan](https://github.com/stipsan)! - Only enable `devExports: true` by default when the project package manager is detected as pnpm, preventing npm and other package managers from publishing source-only exports.

## 0.14.0

### Minor Changes

- [#3017](https://github.com/sanity-io/pkg-utils/pull/3017) [`e73018a`](https://github.com/sanity-io/pkg-utils/commit/e73018a313d69ce1d82cef63f650052a1a646f5b) Thanks [@stipsan](https://github.com/stipsan)! - feat: expose tsdown's top-level `target` option, passed through as-is like `format`, `dts` and `define`. It downlevels JS syntax for the given runtimes and doubles as the default CSS syntax lowering target when `vanillaExtract` is enabled

- [#3017](https://github.com/sanity-io/pkg-utils/pull/3017) [`e73018a`](https://github.com/sanity-io/pkg-utils/commit/e73018a313d69ce1d82cef63f650052a1a646f5b) Thanks [@stipsan](https://github.com/stipsan)! - feat: the `vanillaExtract` option is now powered by `@sanity/vanilla-extract-tsdown-plugin` instead of `@vanilla-extract/rollup-plugin`, so enabling it no longer pulls `rollup` (a peer dependency of the rollup plugin) into tsdown projects. The alpha `vanillaExtract` options are now modeled after the `css` options of `@tsdown/css`: `extract.name` is now `fileName`, `browserslist` is now the esbuild-style `target` (defaulting to tsdown's top-level `target` when it includes browsers, then `@sanity/browserslist-config`), `extract.compatMode` is now `inject: {nodeCompat: true}` (the default here - `inject: true` injects a plain relative CSS import instead), and CSS sourcemaps (`extract.sourcemap`) are no longer emitted, aligned with `@tsdown/css`. The `cwd`, `esbuildOptions` and `unstable_injectFilescopes` options have been removed

- [#3017](https://github.com/sanity-io/pkg-utils/pull/3017) [`e73018a`](https://github.com/sanity-io/pkg-utils/commit/e73018a313d69ce1d82cef63f650052a1a646f5b) Thanks [@stipsan](https://github.com/stipsan)! - feat: forward tsdown's `exports` option with the Sanity defaults documented on `PackageOptions` (`enabled: 'local-only'` and `devExports: true`), applied with tsdown's `mergeConfig` semantics: an object deep-merges over the defaults, while any other value (`false`, a bare CI condition) replaces them. The `tsconfig` option no longer defaults to `'tsconfig.json'` and is forwarded as-is, since tsdown auto-detects the project tsconfig. Options that aren't exposed on `PackageOptions` can be customized by merging over the returned config with tsdown's `mergeConfig`, now documented in the README

- [#3021](https://github.com/sanity-io/pkg-utils/pull/3021) [`acf844f`](https://github.com/sanity-io/pkg-utils/commit/acf844ff5787cfcf8e3238118f26dd910c728b1a) Thanks [@stipsan](https://github.com/stipsan)! - Rely on tsdown's default hashed chunk filenames (`[name]-[hash].<ext>`) instead of setting `hash: false` and emitting shared chunks into `_chunks-es`, `_chunks-cjs` and `_chunks-dts` folders.

  The hash suffix keeps a shared (non-entry) chunk from ever taking an entry's filename, which is what the `_chunks-*` folders were guarding against: code shared between two entries forms a chunk that rolldown may name after one of the entries (e.g. `theme`), and without the hash the d.ts output could hand the entry's `theme.d.ts` filename to the chunk - which exports everything under minified aliases - breaking every named import from that entry with `TS2460` (see [sanity-io/ui#2262](https://github.com/sanity-io/ui/issues/2262)). Entries keep their stable, unhashed filenames, so public import paths are unaffected; only the internal chunk filenames change (e.g. `_chunks-es/theme.js` becomes `theme-CYP9-xTb.js`).

  Opting out of the hashing is possible by merging `{hash: false}` over the returned config with tsdown's `mergeConfig` (at the risk of reintroducing the filename collision on multi-entry packages, unless `outputOptions.chunkFileNames` keeps chunks away from the entries).

### Patch Changes

- [#3018](https://github.com/sanity-io/pkg-utils/pull/3018) [`99bd418`](https://github.com/sanity-io/pkg-utils/commit/99bd41811995bb1ac94254f50f11eec80db2cbe7) Thanks [@stipsan](https://github.com/stipsan)! - Remove `outputOptions.hoistTransitiveImports: false`, the option is not implemented in rolldown and has no effect

- Updated dependencies [[`e73018a`](https://github.com/sanity-io/pkg-utils/commit/e73018a313d69ce1d82cef63f650052a1a646f5b)]:
  - @sanity/vanilla-extract-tsdown-plugin@0.1.0

## 0.13.1

### Patch Changes

- [#3008](https://github.com/sanity-io/pkg-utils/pull/3008) [`abd8c07`](https://github.com/sanity-io/pkg-utils/commit/abd8c0792cfbe7a021bc861bb3dfb2cfb2de9cf9) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency @vanilla-extract/rollup-plugin to ^1.5.4

- [#3015](https://github.com/sanity-io/pkg-utils/pull/3015) [`d619032`](https://github.com/sanity-io/pkg-utils/commit/d6190327863a4c101f857f5825f41113c8a3f8c3) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to v0.22.5

## 0.13.0

### Minor Changes

- [#2978](https://github.com/sanity-io/pkg-utils/pull/2978) [`9caf824`](https://github.com/sanity-io/pkg-utils/commit/9caf8244a299e5fc04a9928d64a939c08d599c04) Thanks [@stipsan](https://github.com/stipsan)! - feat: support TypeScript 7 (the Go-native compiler), require TypeScript 6 or later

  **BREAKING**: the `typescript` peer dependency range is now `6.x || 7.x` — TypeScript 5.x is no longer supported. TypeScript 7 is not required yet, but 6.0 is the new minimum.

  - The classic JS compiler API (used for parsing `tsconfig.json` and the `api-extractor` dts pipeline) is now always loaded from the official [`@typescript/typescript6`](https://www.npmjs.com/package/@typescript/typescript6) compat package (a regular dependency), since TypeScript 7 no longer ships it. The installed `typescript` peer no longer affects that pipeline.
  - `dts: 'rolldown'` upgrades to `rolldown-plugin-dts` 0.27.x: with `typescript` v7 installed, type generation automatically uses the Go-native compiler (`tsgo`) from the `typescript` package itself, without needing `@typescript/native-preview`. With v6, the previous behavior is unchanged (`tsgo` is opt-in via the `tsgo` option or `@typescript/native-preview` in `devDependencies`, and `tsgo: false` still opts out).

## 0.12.1

### Patch Changes

- [#2979](https://github.com/sanity-io/pkg-utils/pull/2979) [`cc771d2`](https://github.com/sanity-io/pkg-utils/commit/cc771d2386471ca64cc513c33dadd944f04f0755) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency vitest to ^4.1.10

- [#2987](https://github.com/sanity-io/pkg-utils/pull/2987) [`9fe5a25`](https://github.com/sanity-io/pkg-utils/commit/9fe5a255824f1900af60e34d3008469bd3d8b264) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to v0.22.3

- [#2990](https://github.com/sanity-io/pkg-utils/pull/2990) [`f067d9a`](https://github.com/sanity-io/pkg-utils/commit/f067d9a19db5501c98ec2bc7896586c35122436f) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency browserslist to ^4.28.5

## 0.12.0

### Minor Changes

- [#2967](https://github.com/sanity-io/pkg-utils/pull/2967) [`b5d524e`](https://github.com/sanity-io/pkg-utils/commit/b5d524e130cf66c845e183d6c7b70ef36461610e) Thanks [@stipsan](https://github.com/stipsan)! - Emit shared (non-entry) chunks into `_chunks-es`, `_chunks-cjs` and `_chunks-dts` folders, following the same naming convention as `@sanity/pkg-utils`, instead of placing them at the root of `dist` next to the entries.

  A chunk could otherwise take an entry's filename: code shared between two entries forms a chunk that rolldown may name after one of the entries (e.g. `theme`). The JS output deduplicates such filename collisions in favor of the entry, but the d.ts output could resolve them the other way around, handing the entry's `.d.ts` filename to the chunk - which exports everything under minified aliases like `buildTheme as x` - so every named import from that entry failed to type-check with `TS2460` (see [sanity-io/ui#2262](https://github.com/sanity-io/ui/issues/2262)). With chunks emitted into their own folders they can never collide with entry filenames.

## 0.11.0

### Minor Changes

- [#2961](https://github.com/sanity-io/pkg-utils/pull/2961) [`c32c11d`](https://github.com/sanity-io/pkg-utils/commit/c32c11d7c28e9a2bb7ae138874e1c5b0f96dcbe1) Thanks [@stipsan](https://github.com/stipsan)! - Add `dts` and `define` options, passed through to `tsdown` as-is.

  The `dts` option customizes how `.d.ts` files are generated, for example to use `tsgo` for type generation (the same feature as the `tsgo` option in `@sanity/pkg-utils`, requires `@typescript/native-preview` to be installed):

  ```ts
  import {defineConfig} from '@sanity/tsdown-config'

  export default defineConfig({
    tsconfig: 'tsconfig.dist.json',
    dts: {tsgo: true},
  })
  ```

  The `define` option replaces global identifiers with constant expressions at build time (the same feature as the `define` option in `@sanity/pkg-utils`):

  ```ts
  import {defineConfig} from '@sanity/tsdown-config'

  export default defineConfig({
    tsconfig: 'tsconfig.dist.json',
    define: {'process.env.NODE_ENV': JSON.stringify('production')},
  })
  ```

## 0.10.0

### Minor Changes

- [#2937](https://github.com/sanity-io/pkg-utils/pull/2937) [`cfa9845`](https://github.com/sanity-io/pkg-utils/commit/cfa984514d196dff447413997b2b76b615f44656) Thanks [@stipsan](https://github.com/stipsan)! - feat: add the `vanillaExtract` option known from `@sanity/pkg-utils`

  Enables `@vanilla-extract/rollup-plugin` to extract CSS from `.css.ts` files into a separate file that is optimized with `lightningcss`. Like in `@sanity/pkg-utils`, the compat mode (on by default) automatically injects the self-referential `import "<pkg>/bundle.css"` into the entry chunk, emits a no-op `bundle.css.js` shim (plus `bundle.css.d.ts`) for runtimes that cannot import `.css` files, and writes the conditional `"./bundle.css"` export (`browser`/`style` → the real CSS, `node`/`default` → the shim) to `package.json`.

  The feature is fully opt-in: neither `@vanilla-extract/rollup-plugin` nor the CSS toolchain (`lightningcss`, `browserslist`) is loaded unless `vanillaExtract` is enabled.

## 0.9.0

### Minor Changes

- [#2954](https://github.com/sanity-io/pkg-utils/pull/2954) [`ec35d61`](https://github.com/sanity-io/pkg-utils/commit/ec35d6199b6833378cd9ecfe3a696811128132b9) Thanks [@stipsan](https://github.com/stipsan)! - Add `reactCompiler` option, the same feature as `babel: {reactCompiler: true}` in `@sanity/pkg-utils`.

  ```ts
  import {defineConfig} from '@sanity/tsdown-config'

  export default defineConfig({
    tsconfig: 'tsconfig.dist.json',
    reactCompiler: true,
  })
  ```

  It runs `babel-plugin-react-compiler` on the source files before they are bundled, so published components are memoized automatically. Pass an object instead of `true` to configure the compiler with the same options as `babel-plugin-react-compiler` (e.g. `reactCompiler: {target: '18'}`). Requires `babel-plugin-react-compiler` to be installed.

## 0.8.0

### Minor Changes

- [#2953](https://github.com/sanity-io/pkg-utils/pull/2953) [`fd85068`](https://github.com/sanity-io/pkg-utils/commit/fd85068fa452f8c246156701a64466f4fd93f59c) Thanks [@stipsan](https://github.com/stipsan)! - Add `styledComponents` option, the same feature as `babel: {styledComponents: true}` in `@sanity/pkg-utils`.

  ```ts
  import {defineConfig} from '@sanity/tsdown-config'

  export default defineConfig({
    tsconfig: 'tsconfig.dist.json',
    styledComponents: true,
  })
  ```

  It applies the `styled-components` transform (adding `displayName` for better debugging, `componentId` to avoid SSR hydration mismatches, and minifying the CSS in tagged template literals) with the same defaults as `@sanity/pkg-utils`. Unlike `@sanity/pkg-utils` it doesn't require installing `babel-plugin-styled-components`, as it uses oxc's native port of the babel plugin. Pass an object instead of `true` to customize the transform with the same options as `babel-plugin-styled-components`.

## 0.7.3

### Patch Changes

- [#2934](https://github.com/sanity-io/pkg-utils/pull/2934) [`d6cfe32`](https://github.com/sanity-io/pkg-utils/commit/d6cfe325c12623e63d0039a1ce76c41c53d86dfd) Thanks [@stipsan](https://github.com/stipsan)! - fix: preserve side-effect-only imports of external packages

  Tree-shaking no longer sets the equivalent of `moduleSideEffects: 'no-external'` and instead relies on the bundler's default (`moduleSideEffects: true`). Previously, binding-less side-effect imports of external package subpaths — e.g. `import 'react-time-ago/locale/en'` — were stripped from the output, breaking consumers that depended on those side effects. `package.json` `sideEffects` fields are still honored for bundled modules, so dead-code elimination is unaffected.

## 0.7.2

### Patch Changes

- [#2828](https://github.com/sanity-io/pkg-utils/pull/2828) [`66b1028`](https://github.com/sanity-io/pkg-utils/commit/66b10281b75cb3ab0bfd8801bd52c71ec94a885b) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.22.2

- Updated dependencies [[`66b1028`](https://github.com/sanity-io/pkg-utils/commit/66b10281b75cb3ab0bfd8801bd52c71ec94a885b)]:
  - @sanity/parse-package-json@2.1.7

## 0.7.1

### Patch Changes

- [#2810](https://github.com/sanity-io/pkg-utils/pull/2810) [`370f616`](https://github.com/sanity-io/pkg-utils/commit/370f616431326e2311f261636e37d53915ee57ec) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.22.1

- Updated dependencies [[`370f616`](https://github.com/sanity-io/pkg-utils/commit/370f616431326e2311f261636e37d53915ee57ec)]:
  - @sanity/parse-package-json@2.1.6

## 0.7.0

### Minor Changes

- [#2790](https://github.com/sanity-io/pkg-utils/pull/2790) [`92c6121`](https://github.com/sanity-io/pkg-utils/commit/92c6121630681f0fe67262a4fac7de94bdf8743b) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - feat(deps): Upgrade tsdown peer dependency to 0.22.x

### Patch Changes

- Updated dependencies [[`60f10ad`](https://github.com/sanity-io/pkg-utils/commit/60f10ad058aa49b2f400e3208e0fe109d80000aa)]:
  - @sanity/parse-package-json@2.1.5

## 0.6.1

### Patch Changes

- [#2755](https://github.com/sanity-io/pkg-utils/pull/2755) [`a2246f5`](https://github.com/sanity-io/pkg-utils/commit/a2246f51ce9cd11e56c0a671d81a7593f6f6fe32) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.21.10

- Updated dependencies [[`a2246f5`](https://github.com/sanity-io/pkg-utils/commit/a2246f51ce9cd11e56c0a671d81a7593f6f6fe32)]:
  - @sanity/parse-package-json@2.1.4

## 0.6.0

### Minor Changes

- [#2737](https://github.com/sanity-io/pkg-utils/pull/2737) [`a630af5`](https://github.com/sanity-io/pkg-utils/commit/a630af50ab2b1cbb7730232cf7677200249e8b54) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Upgrade `tsdown` peer dependency from `0.20.x` to `0.21.x`

### Patch Changes

- Updated dependencies []:
  - @sanity/parse-package-json@2.1.3

## 0.5.8

### Patch Changes

- [#2512](https://github.com/sanity-io/pkg-utils/pull/2512) [`8652e7e`](https://github.com/sanity-io/pkg-utils/commit/8652e7e2448e265b3bb2c54ad9a7c506682d1f85) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.20.1

- Updated dependencies [[`8652e7e`](https://github.com/sanity-io/pkg-utils/commit/8652e7e2448e265b3bb2c54ad9a7c506682d1f85), [`3277895`](https://github.com/sanity-io/pkg-utils/commit/3277895f328ad26d3e37c7cf30f60f75f7bd37b2)]:
  - @sanity/parse-package-json@2.1.3

## 0.5.7

### Patch Changes

- [#2481](https://github.com/sanity-io/pkg-utils/pull/2481) [`d722c3c`](https://github.com/sanity-io/pkg-utils/commit/d722c3cc2546501c815a522fe978ac35f5415178) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.19.0

- Updated dependencies [[`d722c3c`](https://github.com/sanity-io/pkg-utils/commit/d722c3cc2546501c815a522fe978ac35f5415178)]:
  - @sanity/parse-package-json@2.1.2

## 0.5.6

### Patch Changes

- [#2448](https://github.com/sanity-io/pkg-utils/pull/2448) [`b5b113f`](https://github.com/sanity-io/pkg-utils/commit/b5b113f2d9f9bbe29cea56a877f3b50bf32d7584) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.18.4

- Updated dependencies [[`b5b113f`](https://github.com/sanity-io/pkg-utils/commit/b5b113f2d9f9bbe29cea56a877f3b50bf32d7584)]:
  - @sanity/parse-package-json@2.1.1

## 0.5.5

### Patch Changes

- Updated dependencies [[`9c8fad8`](https://github.com/sanity-io/pkg-utils/commit/9c8fad8c58bfd4cd7c98f5a32aa30cfee9c12b7e), [`d05d1b9`](https://github.com/sanity-io/pkg-utils/commit/d05d1b936d07d32901f1748f15c245ec6af7e95c)]:
  - @sanity/parse-package-json@2.1.0

## 0.5.4

### Patch Changes

- Updated dependencies [[`5537cfc`](https://github.com/sanity-io/pkg-utils/commit/5537cfc0fe66bf1265978d7d4cf7bd9e76cbee1b)]:
  - @sanity/parse-package-json@2.0.5

## 0.5.3

### Patch Changes

- [#2440](https://github.com/sanity-io/pkg-utils/pull/2440) [`f50f6f1`](https://github.com/sanity-io/pkg-utils/commit/f50f6f1e45b5e4811d6e25621b4333f44c0ea0d9) Thanks [@stipsan](https://github.com/stipsan)! - Update LICENSE year to 2026

- Updated dependencies [[`f50f6f1`](https://github.com/sanity-io/pkg-utils/commit/f50f6f1e45b5e4811d6e25621b4333f44c0ea0d9)]:
  - @sanity/parse-package-json@2.0.4

## 0.5.2

### Patch Changes

- [#2427](https://github.com/sanity-io/pkg-utils/pull/2427) [`405355c`](https://github.com/sanity-io/pkg-utils/commit/405355c627e66ea95afa085ac23d010b6de9c7eb) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to ^0.18.3

- Updated dependencies [[`405355c`](https://github.com/sanity-io/pkg-utils/commit/405355c627e66ea95afa085ac23d010b6de9c7eb)]:
  - @sanity/parse-package-json@2.0.3

## 0.5.1

### Patch Changes

- Updated dependencies [[`0963ad2`](https://github.com/sanity-io/pkg-utils/commit/0963ad27a3ac388fc7fc3981a7f77319325edb67)]:
  - @sanity/parse-package-json@2.0.2

## 0.5.0

### Minor Changes

- [#2392](https://github.com/sanity-io/pkg-utils/pull/2392) [`9dd0d4d`](https://github.com/sanity-io/pkg-utils/commit/9dd0d4d2f1ac17999cea6402d1a9bb1100aaebbf) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to ^0.18.0

### Patch Changes

- Updated dependencies [[`9dd0d4d`](https://github.com/sanity-io/pkg-utils/commit/9dd0d4d2f1ac17999cea6402d1a9bb1100aaebbf), [`d8678ee`](https://github.com/sanity-io/pkg-utils/commit/d8678eea4e693f0f4a545be0bfcd79dd248d4e37)]:
  - @sanity/parse-package-json@2.0.1

## 0.4.2

### Patch Changes

- Updated dependencies [[`b3858a0`](https://github.com/sanity-io/pkg-utils/commit/b3858a0fe43f2a91c20ba19f95fc8d2586e87e87)]:
  - @sanity/parse-package-json@2.0.0

## 0.4.1

### Patch Changes

- [`e99bfd1`](https://github.com/sanity-io/pkg-utils/commit/e99bfd18048de04c12c433bd7d8bf39ba7cc9f7e) Thanks [@stipsan](https://github.com/stipsan)! - Forward the `entry` option correctly

- [#2361](https://github.com/sanity-io/pkg-utils/pull/2361) [`7b12b38`](https://github.com/sanity-io/pkg-utils/commit/7b12b38a567e35e74eb36d7aa83b92fba5195011) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to ^0.17.2

- Updated dependencies [[`7b12b38`](https://github.com/sanity-io/pkg-utils/commit/7b12b38a567e35e74eb36d7aa83b92fba5195011), [`1521aab`](https://github.com/sanity-io/pkg-utils/commit/1521aab75d660fe15377337fe22542619e779f4a), [`e99bfd1`](https://github.com/sanity-io/pkg-utils/commit/e99bfd18048de04c12c433bd7d8bf39ba7cc9f7e)]:
  - @sanity/parse-package-json@1.1.0

## 0.4.0

### Minor Changes

- [#2353](https://github.com/sanity-io/pkg-utils/pull/2353) [`82b99cd`](https://github.com/sanity-io/pkg-utils/commit/82b99cdc6350e4963366ebfcdeba37e2988711e2) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to ^0.17.0

### Patch Changes

- Updated dependencies [[`82b99cd`](https://github.com/sanity-io/pkg-utils/commit/82b99cdc6350e4963366ebfcdeba37e2988711e2)]:
  - @sanity/parse-package-json@1.0.1

## 0.3.0

### Minor Changes

- [#2344](https://github.com/sanity-io/pkg-utils/pull/2344) [`7f3d821`](https://github.com/sanity-io/pkg-utils/commit/7f3d821055918a2ffdeb4a1fdf5b9be741558e34) Thanks [@stipsan](https://github.com/stipsan)! - Add `outputOptions.hoistTransitiveImports: false`

- [#2344](https://github.com/sanity-io/pkg-utils/pull/2344) [`7f3d821`](https://github.com/sanity-io/pkg-utils/commit/7f3d821055918a2ffdeb4a1fdf5b9be741558e34) Thanks [@stipsan](https://github.com/stipsan)! - Add `inputOptions.preserveEntrySignatures: 'strict'`

- [#2344](https://github.com/sanity-io/pkg-utils/pull/2344) [`7f3d821`](https://github.com/sanity-io/pkg-utils/commit/7f3d821055918a2ffdeb4a1fdf5b9be741558e34) Thanks [@stipsan](https://github.com/stipsan)! - Set `hash: false`

- [#2344](https://github.com/sanity-io/pkg-utils/pull/2344) [`7f3d821`](https://github.com/sanity-io/pkg-utils/commit/7f3d821055918a2ffdeb4a1fdf5b9be741558e34) Thanks [@stipsan](https://github.com/stipsan)! - Set devExports to `true` instead of `'source'`

- [#2344](https://github.com/sanity-io/pkg-utils/pull/2344) [`7f3d821`](https://github.com/sanity-io/pkg-utils/commit/7f3d821055918a2ffdeb4a1fdf5b9be741558e34) Thanks [@stipsan](https://github.com/stipsan)! - Add `treeshake` options

- [#2344](https://github.com/sanity-io/pkg-utils/pull/2344) [`7f3d821`](https://github.com/sanity-io/pkg-utils/commit/7f3d821055918a2ffdeb4a1fdf5b9be741558e34) Thanks [@stipsan](https://github.com/stipsan)! - Add `minify: {compress: true}`

### Patch Changes

- Updated dependencies []:
  - @sanity/parse-package-json@1.0.0

## 0.2.0

### Minor Changes

- [#2337](https://github.com/sanity-io/pkg-utils/pull/2337) [`04f3675`](https://github.com/sanity-io/pkg-utils/commit/04f36755337e4a09de6e6d890834b45645edb03c) Thanks [@stipsan](https://github.com/stipsan)! - Allow setting `platform`

## 0.1.0

### Minor Changes

- [#2331](https://github.com/sanity-io/pkg-utils/pull/2331) [`ae7b51c`](https://github.com/sanity-io/pkg-utils/commit/ae7b51c31deeac4af706520d39b94b22cd6112f0) Thanks [@stipsan](https://github.com/stipsan)! - Add `declarationMap: true` to tsconfig preset

## 0.0.2

### Patch Changes

- [#2322](https://github.com/sanity-io/pkg-utils/pull/2322) [`b8f42f3`](https://github.com/sanity-io/pkg-utils/commit/b8f42f36c98a14329c3465bb54c3ea07ac8d2dc6) Thanks [@stipsan](https://github.com/stipsan)! - Initial test release
