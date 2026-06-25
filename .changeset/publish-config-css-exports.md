---
"@sanity/parse-package-json": patch
---

fix: allow conditional CSS exports in `publishConfig.exports`

Conditional CSS exports (e.g. the `bundle.css` browser/node/default map) are now accepted in `publishConfig.exports`, matching the support already present for the top-level `exports` field. Previously declaring one there threw a validation error (`Expected object, received string`).
