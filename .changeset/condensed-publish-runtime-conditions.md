---
'@sanity/parse-package-json': patch
'@sanity/pkg-utils': patch
---

Accept a runtime condition condensed to a plain string in `publishConfig.exports`
(`"node": "./dist/index.node.js"` resolves identically to
`"node": {"default": "./dist/index.node.js"}`), which is what is left of a `{source, default}`
condition once `source` is stripped for publishing. Validating an export subpath now also picks the
expected shape from the subpath itself, so a malformed entry is reported against the condition that
is wrong instead of as `A conditional CSS export must resolve to at least one ".css" file`, and a
`package.json` validation error that carries its own message is printed as a message rather than as
a raw issue object.
