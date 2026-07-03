---
'@sanity/tsconfig': minor
---

Add `outDir: "${configDir}/dist"` to the `recommended` preset

Since `${configDir}` resolves to the directory of the tsconfig that extends the preset, output always lands in the `dist` folder next to your `package.json`, and it no longer needs to be declared manually:

```diff
{
  "extends": "@sanity/tsconfig/strictest",
-  "compilerOptions": {
-    "outDir": "${configDir}/dist"
-  }
}
```
