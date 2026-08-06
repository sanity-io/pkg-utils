---
'@sanity/tsdown-config': minor
'@sanity/pkg-utils': patch
---

Move the `tsdoc` feature (API Extractor TSDoc/release-tag checking) from `@sanity/pkg-utils` into `@sanity/tsdown-config`.

In `@sanity/tsdown-config` the option is `false` by default; set `tsdoc: true` (or an options object) to run the check after the build via tsdown's `build:done` hook. The checker lives at `@sanity/tsdown-config/tsdoc` and is lazy-loaded from the root config, so API Extractor is not part of the default entry's module graph. `@sanity/pkg-utils` continues enabling it by default (`tsdoc: true`) when composing the config, and still runs it during `pkg check` via `checkTsdoc` from `@sanity/tsdown-config/tsdoc`.
