# @sanity/parse-package-json

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
