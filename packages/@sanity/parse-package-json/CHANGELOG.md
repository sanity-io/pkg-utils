# @sanity/parse-package-json

## 2.2.6

### Patch Changes

- [#3032](https://github.com/sanity-io/pkg-utils/pull/3032) [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a) Thanks [@stipsan](https://github.com/stipsan)! - fix: use a literal `@` instead of the percent-encoded `%40` in the `homepage` links to the `packages/@sanity/*` directories, so the URLs read cleanly in the npm UI (GitHub resolves both forms)

## 2.2.5

### Patch Changes

- [#3034](https://github.com/sanity-io/pkg-utils/pull/3034) [`86402fa`](https://github.com/sanity-io/pkg-utils/commit/86402fab7fe41dbc955cde8f47588cc9426a513c) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.8

## 2.2.4

### Patch Changes

- [#3026](https://github.com/sanity-io/pkg-utils/pull/3026) [`04a6206`](https://github.com/sanity-io/pkg-utils/commit/04a62060a553e40d5d336b1b89e75f44d44bcf79) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to ^0.22.7

## 2.2.3

### Patch Changes

- [#3015](https://github.com/sanity-io/pkg-utils/pull/3015) [`d619032`](https://github.com/sanity-io/pkg-utils/commit/d6190327863a4c101f857f5825f41113c8a3f8c3) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency tsdown to v0.22.5

## 2.2.2

### Patch Changes

- [#2979](https://github.com/sanity-io/pkg-utils/pull/2979) [`cc771d2`](https://github.com/sanity-io/pkg-utils/commit/cc771d2386471ca64cc513c33dadd944f04f0755) Thanks [@squiggler-app](https://github.com/apps/squiggler-app)! - fix(deps): update dependency vitest to ^4.1.10

## 2.2.1

### Patch Changes

- [#2890](https://github.com/sanity-io/pkg-utils/pull/2890) [`c219497`](https://github.com/sanity-io/pkg-utils/commit/c219497fb7e354c9e9d518184ccf141fc40cd111) Thanks [@stipsan](https://github.com/stipsan)! - fix: allow conditional CSS exports in `publishConfig.exports`

  Conditional CSS exports (e.g. the `bundle.css` browser/node/default map) are now accepted in `publishConfig.exports`, matching the support already present for the top-level `exports` field. Previously declaring one there threw a validation error (`Expected object, received string`).

## 2.2.0

### Minor Changes

- [#2887](https://github.com/sanity-io/pkg-utils/pull/2887) [`a6adaa1`](https://github.com/sanity-io/pkg-utils/commit/a6adaa193a82dd09ce5213ecab2588b9d1b20361) Thanks [@stipsan](https://github.com/stipsan)! - feat: support conditional `exports` for CSS files

  CSS subpath exports may now be declared as a conditional object (a flat map of condition name to path) instead of only a plain string. This enables re-adding a `import "<pkg>/bundle.css"` statement that resolves to the real CSS file in bundler/browser environments, while resolving to a no-op JS shim in runtimes (like Node) that cannot import `.css` files directly:

  ```json
  {
    "exports": {
      "./bundle.css": {
        "browser": "./dist/bundle.css",
        "style": "./dist/bundle.css",
        "node": "./dist/bundle.css.js",
        "default": "./dist/bundle.css.js"
      }
    }
  }
  ```

## 2.1.7

### Patch Changes

- [#2828](https://github.com/sanity-io/pkg-utils/pull/2828) [`66b1028`](https://github.com/sanity-io/pkg-utils/commit/66b10281b75cb3ab0bfd8801bd52c71ec94a885b) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.22.2

## 2.1.6

### Patch Changes

- [#2810](https://github.com/sanity-io/pkg-utils/pull/2810) [`370f616`](https://github.com/sanity-io/pkg-utils/commit/370f616431326e2311f261636e37d53915ee57ec) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.22.1

## 2.1.5

### Patch Changes

- [#2769](https://github.com/sanity-io/pkg-utils/pull/2769) [`60f10ad`](https://github.com/sanity-io/pkg-utils/commit/60f10ad058aa49b2f400e3208e0fe109d80000aa) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): Update dependency zod to ^4.4.3

## 2.1.4

### Patch Changes

- [#2755](https://github.com/sanity-io/pkg-utils/pull/2755) [`a2246f5`](https://github.com/sanity-io/pkg-utils/commit/a2246f51ce9cd11e56c0a671d81a7593f6f6fe32) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.21.10

## 2.1.3

### Patch Changes

- [#2512](https://github.com/sanity-io/pkg-utils/pull/2512) [`8652e7e`](https://github.com/sanity-io/pkg-utils/commit/8652e7e2448e265b3bb2c54ad9a7c506682d1f85) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.20.1

- [#2521](https://github.com/sanity-io/pkg-utils/pull/2521) [`3277895`](https://github.com/sanity-io/pkg-utils/commit/3277895f328ad26d3e37c7cf30f60f75f7bd37b2) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): Update dependency zod to ^4.3.6

## 2.1.2

### Patch Changes

- [#2481](https://github.com/sanity-io/pkg-utils/pull/2481) [`d722c3c`](https://github.com/sanity-io/pkg-utils/commit/d722c3cc2546501c815a522fe978ac35f5415178) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.19.0

## 2.1.1

### Patch Changes

- [#2448](https://github.com/sanity-io/pkg-utils/pull/2448) [`b5b113f`](https://github.com/sanity-io/pkg-utils/commit/b5b113f2d9f9bbe29cea56a877f3b50bf32d7584) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to v0.18.4

## 2.1.0

### Minor Changes

- [#2465](https://github.com/sanity-io/pkg-utils/pull/2465) [`d05d1b9`](https://github.com/sanity-io/pkg-utils/commit/d05d1b936d07d32901f1748f15c245ec6af7e95c) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add support for `monorepo` export condition alongside `development` and `source` conditions

### Patch Changes

- [#2459](https://github.com/sanity-io/pkg-utils/pull/2459) [`9c8fad8`](https://github.com/sanity-io/pkg-utils/commit/9c8fad8c58bfd4cd7c98f5a32aa30cfee9c12b7e) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): Update dependency zod to ^4.3.5

## 2.0.5

### Patch Changes

- [#2451](https://github.com/sanity-io/pkg-utils/pull/2451) [`5537cfc`](https://github.com/sanity-io/pkg-utils/commit/5537cfc0fe66bf1265978d7d4cf7bd9e76cbee1b) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): Update dependency zod to ^4.3.4

## 2.0.4

### Patch Changes

- [#2440](https://github.com/sanity-io/pkg-utils/pull/2440) [`f50f6f1`](https://github.com/sanity-io/pkg-utils/commit/f50f6f1e45b5e4811d6e25621b4333f44c0ea0d9) Thanks [@stipsan](https://github.com/stipsan)! - Update LICENSE year to 2026

## 2.0.3

### Patch Changes

- [#2427](https://github.com/sanity-io/pkg-utils/pull/2427) [`405355c`](https://github.com/sanity-io/pkg-utils/commit/405355c627e66ea95afa085ac23d010b6de9c7eb) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to ^0.18.3

## 2.0.2

### Patch Changes

- [#2422](https://github.com/sanity-io/pkg-utils/pull/2422) [`0963ad2`](https://github.com/sanity-io/pkg-utils/commit/0963ad27a3ac388fc7fc3981a7f77319325edb67) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): Update dependency zod to ^4.2.1

## 2.0.1

### Patch Changes

- [#2392](https://github.com/sanity-io/pkg-utils/pull/2392) [`9dd0d4d`](https://github.com/sanity-io/pkg-utils/commit/9dd0d4d2f1ac17999cea6402d1a9bb1100aaebbf) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to ^0.18.0

- [#2413](https://github.com/sanity-io/pkg-utils/pull/2413) [`d8678ee`](https://github.com/sanity-io/pkg-utils/commit/d8678eea4e693f0f4a545be0bfcd79dd248d4e37) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): Update dependency zod to ^4.2.0

## 2.0.0

### Major Changes

- [#2385](https://github.com/sanity-io/pkg-utils/pull/2385) [`b3858a0`](https://github.com/sanity-io/pkg-utils/commit/b3858a0fe43f2a91c20ba19f95fc8d2586e87e87) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add stricter publishConfig.exports validation to ensure values match exports

## 1.1.0

### Minor Changes

- [#2383](https://github.com/sanity-io/pkg-utils/pull/2383) [`1521aab`](https://github.com/sanity-io/pkg-utils/commit/1521aab75d660fe15377337fe22542619e779f4a) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add support for `development` export condition and `publishConfig.exports` validation

  Implements tsdown's conditional dev exports pattern to enable TypeScript language servers and HMR without build steps or resolve.alias hacks during local development.
  - Added validation that `development` must equal `source` when both are present
  - Added new strict check `noPublishConfigExports` (default: warn) that flags missing `publishConfig.exports` when dev conditions are used
  - Added comprehensive validation for `publishConfig.exports` structure
  - Supports condensed string format when only `default` remains after removing `source`/`development`

- [`e99bfd1`](https://github.com/sanity-io/pkg-utils/commit/e99bfd18048de04c12c433bd7d8bf39ba7cc9f7e) Thanks [@stipsan](https://github.com/stipsan)! - - Added `development` condition to export types and schema
  - Added `publishConfig` support with `exports`, `access`, `registry`, `tag`, and passthrough for arbitrary npm config

### Patch Changes

- [#2361](https://github.com/sanity-io/pkg-utils/pull/2361) [`7b12b38`](https://github.com/sanity-io/pkg-utils/commit/7b12b38a567e35e74eb36d7aa83b92fba5195011) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to ^0.17.2

## 1.0.1

### Patch Changes

- [#2353](https://github.com/sanity-io/pkg-utils/pull/2353) [`82b99cd`](https://github.com/sanity-io/pkg-utils/commit/82b99cdc6350e4963366ebfcdeba37e2988711e2) Thanks [@renovate](https://github.com/apps/renovate)! - fix(deps): update dependency tsdown to ^0.17.0

## 1.0.0

### Major Changes

- [#2337](https://github.com/sanity-io/pkg-utils/pull/2337) [`04f3675`](https://github.com/sanity-io/pkg-utils/commit/04f36755337e4a09de6e6d890834b45645edb03c) Thanks [@stipsan](https://github.com/stipsan)! - Initial release
