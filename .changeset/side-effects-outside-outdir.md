---
"@sanity/tsdown-config": patch
"@sanity/pkg-utils": patch
---

fix: don't rewrite `package.json#sideEffects` when `outDir` is outside the package

Calling `build()` with an `outDir` outside the package directory (for example a test that builds into `os.tmpdir()`) wrote paths like `../../tmp/…/styles.css` into `sideEffects`, dropping the real `./dist/…` entries. Such builds now leave `sideEffects` untouched.
