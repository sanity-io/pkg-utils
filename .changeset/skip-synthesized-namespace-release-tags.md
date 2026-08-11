---
'@sanity/tsdown-config': patch
'@sanity/pkg-utils': patch
---

Stop flagging the synthesized namespace wrappers of the declaration bundler with `ae-missing-release-tag`.

Namespace re-exports (`export * as ns from './module'`, or `import * as ns` + `export {ns}`) make the declaration bundling pass synthesize a `declare namespace <module>_d_exports {…}` wrapper that drops the doc comment of the re-export statement, so the wrapper could never carry a release tag and there was no userland fix short of downgrading the rule for the whole package. The TSDoc check now recognizes those wrappers — the interop naming, declared as a namespace (in the entry or a shared chunk), only re-exported under an alias — and exempts them from `ae-missing-release-tag`, like API Extractor's own rollups never checked the equivalent namespace. Everything else, including user symbols that merely resemble the interop naming, stays checked.
