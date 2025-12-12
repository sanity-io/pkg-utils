---
"@sanity/parse-package-json": minor
---

Add support for `development` export condition and `publishConfig.exports` validation

Implements tsdown's conditional dev exports pattern to enable TypeScript language servers and HMR without build steps or resolve.alias hacks during local development.

- Added validation that `development` must equal `source` when both are present
- Added new strict check `noPublishConfigExports` (default: warn) that flags missing `publishConfig.exports` when dev conditions are used
- Added comprehensive validation for `publishConfig.exports` structure
- Supports condensed string format when only `default` remains after removing `source`/`development`
