# @sanity/tsdown-config

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
