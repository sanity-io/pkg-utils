---
'@sanity/tsconfig': minor
---

Add `outDir: "${configDir}/dist"` to the `recommended` preset

Emitting to `dist` is already the default in `@sanity/pkg-utils` and `tsdown`, but every repo extending these presets had to repeat it in their own tsconfig. Since `${configDir}` resolves to the directory of the tsconfig that extends the preset, output now lands in the `dist` folder next to your `package.json` by default, and the manual declaration can be removed:

```diff
{
  "extends": "@sanity/tsconfig/strictest",
-  "compilerOptions": {
-    "outDir": "${configDir}/dist"
-  }
}
```
