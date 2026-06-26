---
"@sanity/pkg-utils": patch
---

fix: mirror the auto-added `bundle.css` export into `publishConfig.exports`

In vanilla-extract compat mode, pkg-utils auto-writes the conditional `"./bundle.css"` export to `package.json`. It only updated the top-level `exports`, so packages that also declare `publishConfig.exports` ended up out of sync, and the next strict `--check` failed with `publishConfig.exports: missing export path "./bundle.css" that exists in exports`.

The conditional CSS export is now mirrored into `publishConfig.exports` as well (when that field exists), keeping the two in sync. The entry is identical in both places since the CSS export has no `source`/`development`/`monorepo` conditions to strip. `publishConfig.exports` is never created when it is absent.
