# @sanity/vanilla-extract-tsdown-plugin

## 0.2.5

### Patch Changes

- Updated dependencies []:
  - @sanity/vanilla-extract-rolldown-plugin@0.2.2

## 0.2.4

### Patch Changes

- [#3077](https://github.com/sanity-io/pkg-utils/pull/3077) [`9ec6ff3`](https://github.com/sanity-io/pkg-utils/commit/9ec6ff3c27fb26da8265cbd3733a0260ee833baa) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.9

- Updated dependencies [[`9ec6ff3`](https://github.com/sanity-io/pkg-utils/commit/9ec6ff3c27fb26da8265cbd3733a0260ee833baa)]:
  - @sanity/vanilla-extract-rolldown-plugin@0.2.1

## 0.2.3

### Patch Changes

- [#3058](https://github.com/sanity-io/pkg-utils/pull/3058) [`685f9c6`](https://github.com/sanity-io/pkg-utils/commit/685f9c6015ba69c9efcb201745a395bf663088b4) Thanks [@stipsan](https://github.com/stipsan)! - Align every rolldown copy on the version vite 8 pins (`1.1.5`, via a pnpm override and `~1.1.5`/`1.1.5` ranges) so vite, tsdown, rolldown-plugin-dts, and the workspace packages all share one copy — and one `Plugin` type, making the cross-version `@ts-expect-error` suppressions from [#3051](https://github.com/sanity-io/pkg-utils/issues/3051) unnecessary. To be bumped when vite updates its pinned rolldown.

- [#3045](https://github.com/sanity-io/pkg-utils/pull/3045) [`3020923`](https://github.com/sanity-io/pkg-utils/commit/30209234b7b8ce6bbb5a3895747d1522d5ee2605) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency rolldown to v1.2.0

- Updated dependencies [[`3020923`](https://github.com/sanity-io/pkg-utils/commit/30209234b7b8ce6bbb5a3895747d1522d5ee2605), [`685f9c6`](https://github.com/sanity-io/pkg-utils/commit/685f9c6015ba69c9efcb201745a395bf663088b4)]:
  - @sanity/vanilla-extract-rolldown-plugin@0.2.0

## 0.2.2

### Patch Changes

- [#3046](https://github.com/sanity-io/pkg-utils/pull/3046) [`bfd86fa`](https://github.com/sanity-io/pkg-utils/commit/bfd86fa8bcd52ed01bfc0cd5302376f5ae09088d) Thanks [@stipsan](https://github.com/stipsan)! - fix(deps): update dependency rolldown to v1.2.0

  Also bumps `@vanilla-extract/vite-plugin` to `^5.2.5` in the benchmark/playground
  comparison baselines (already-latest `@vanilla-extract/css`, `integration`, and
  `rollup-plugin` left unchanged). Patch releases for the vanilla-extract plugins
  republish their READMEs, which link to the refreshed benchmark results.

- Updated dependencies [[`bfd86fa`](https://github.com/sanity-io/pkg-utils/commit/bfd86fa8bcd52ed01bfc0cd5302376f5ae09088d)]:
  - @sanity/vanilla-extract-rolldown-plugin@0.1.2

## 0.2.1

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
  - @sanity/vanilla-extract-rolldown-plugin@0.1.1

## 0.2.0

### Minor Changes

- [#3032](https://github.com/sanity-io/pkg-utils/pull/3032) [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a) Thanks [@stipsan](https://github.com/stipsan)! - feat: CSS syntax lowering and minification now follow the `css` defaults of `@tsdown/css` exactly, and the `@sanity/browserslist-config` opinion moved up into `@sanity/tsdown-config`:

  - `@sanity/vanilla-extract-rolldown-plugin` (and the tsdown plugin wrapping it) no longer depends on `browserslist`/`@sanity/browserslist-config`. Like `css.target` in `@tsdown/css`, syntax lowering is skipped when no `target` is configured anywhere (the option, or the host-resolved top-level `target` — e.g. derived from `engines.node`), or when the configured targets name no browsers (e.g. `'node20'`); `target: false` stays the explicit off switch.
  - `minify` now defaults to `false`, matching `css.minify` in `@tsdown/css` (extracted CSS was previously minified by default).
  - New `lightningcss` option, like `css.lightningcss` in `@tsdown/css`: options passed through to lightningcss's `transform()`, where `lightningcss.targets` takes precedence over the esbuild-style `target` and the plugin-managed fields (`minify`, `cssModules`) win over their lightningcss counterparts. `esbuildTargetToLightningCSS` is exported for hosts that need to convert or inspect esbuild-style targets.
  - `@sanity/tsdown-config` preserves the Sanity-flavored defaults at its level (and now owns the `browserslist`, `@sanity/browserslist-config`, and `lightningcss` dependencies): when the effective CSS target (`vanillaExtract.target`, falling back to the top-level `target`) is undefined or names no browsers, the lowering targets are resolved from `@sanity/browserslist-config` and passed through `lightningcss.targets`. `target: false` (at either level) disables lowering entirely, and a user-provided `lightningcss.targets` wins over the fallback. `vanillaExtract.minify` keeps defaulting to `true` there — published Sanity libraries ship minified CSS, unlike the bare plugins — so nothing changes for `@sanity/tsdown-config` users.

- [#3032](https://github.com/sanity-io/pkg-utils/pull/3032) [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a) Thanks [@stipsan](https://github.com/stipsan)! - feat: the rolldown-generic core of `@sanity/vanilla-extract-tsdown-plugin` is split into a new package, `@sanity/vanilla-extract-rolldown-plugin`. The new package contains everything that only needs rolldown: the `.css.ts` compilation with plugin hook filters, the single-file `lightningcss`-optimized CSS extraction, and the whole `inject` wiring (the relative import, and the `nodeCompat` self-referential import plus no-op shim emission) — so it can be used from raw rolldown (or Vite build-only library setups via `build.rolldownOptions.plugins`) without depending on tsdown. Its peer dependency is `rolldown` (optional) instead of `tsdown`, and host tools can provide resolved defaults (`target`, `packageName`, `cwd`) through the plugin's `api.setBuildContext()`.

  `@sanity/vanilla-extract-tsdown-plugin` is now a thin tsdown adapter over the new package with an unchanged public API: it forwards tsdown's resolved config (the top-level `target` as the default CSS syntax lowering target, the resolved package name for the self-referential import, and `cwd`) through its `tsdownConfigResolved` hook, and keeps writing the conditional `"./<fileName>"` export to `package.json` through `exports.customExports` in its `tsdownConfig` hook when tsdown's `exports` feature is enabled.

### Patch Changes

- Updated dependencies [[`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a), [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a)]:
  - @sanity/vanilla-extract-rolldown-plugin@0.1.0

## 0.1.2

### Patch Changes

- [#3033](https://github.com/sanity-io/pkg-utils/pull/3033) [`fb9ba79`](https://github.com/sanity-io/pkg-utils/commit/fb9ba79dfe6a2ef57d65758ed9d8167e419a3350) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency browserslist to ^4.28.6

- [#3034](https://github.com/sanity-io/pkg-utils/pull/3034) [`86402fa`](https://github.com/sanity-io/pkg-utils/commit/86402fab7fe41dbc955cde8f47588cc9426a513c) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.8

## 0.1.1

### Patch Changes

- [#3026](https://github.com/sanity-io/pkg-utils/pull/3026) [`04a6206`](https://github.com/sanity-io/pkg-utils/commit/04a62060a553e40d5d336b1b89e75f44d44bcf79) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.7

## 0.1.0

### Minor Changes

- [#3017](https://github.com/sanity-io/pkg-utils/pull/3017) [`e73018a`](https://github.com/sanity-io/pkg-utils/commit/e73018a313d69ce1d82cef63f650052a1a646f5b) Thanks [@stipsan](https://github.com/stipsan)! - feat: initial release of `@sanity/vanilla-extract-tsdown-plugin`, a tsdown plugin for vanilla-extract that extracts CSS into a single `lightningcss`-optimized file, following the same architecture and option vocabulary (`fileName`, `minify`, `target`, `inject`) as `@tsdown/css`. Like `css.inject`, `inject` is disabled by default and `inject: true` injects a relative CSS import; `inject: {nodeCompat: true}` wires up the whole conditional CSS export pattern instead - the self-referential import, the no-op JS shim, and the conditional `"./<fileName>"` export written to `package.json` through the plugin's `tsdownConfig` hook when tsdown's `exports` feature is enabled. Unlike `@vanilla-extract/rollup-plugin` it doesn't declare `rollup` as a peer dependency, and it declares plugin hook filters ([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)) so rolldown skips the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related
