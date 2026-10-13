---
"@sanity/vanilla-extract-integration": patch
"@sanity/vanilla-extract-rolldown-plugin": patch
"@sanity/vanilla-extract-tsdown-plugin": patch
"@sanity/vanilla-extract-vite-plugin": patch
---

fix: salt vanilla-extract file scopes with the package version and module content hash

Upstream hashes the bare `packageName + filePath` for its file-scope hash, so identical file paths in different package versions — or with different style content — produce identical class names. When `@sanity/ui` 4.4.4 renumbered its styles, old CSS styled new markup wherever two UI versions shared a page (SAPP-4639). The file scope is now `name@version#contenthash`, so class names are unique across versions and content while keeping the same short shape. Rebuilding a library (e.g. `@sanity/ui`) with this fix is all it takes to get version-unique classes; no config changes needed.
