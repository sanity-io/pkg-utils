---
'@sanity/pkg-utils': patch
---

Emit a `<css>.d.ts` declaration alongside the vanilla-extract compat-mode CSS shim, so dts export checkers that resolve a `.d.ts` for every export target don't crash on a missing declaration file.
