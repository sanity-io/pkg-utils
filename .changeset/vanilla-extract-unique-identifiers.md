---
"@sanity/vanilla-extract-integration": minor
"@sanity/vanilla-extract-rolldown-plugin": minor
"@sanity/vanilla-extract-tsdown-plugin": minor
"@sanity/vanilla-extract-vite-plugin": minor
"@sanity/tsdown-config": minor
---

feat: add the opt-in `identifiers: 'safe'` option, keeping class names apart across package releases

The default `'short'` identifiers hash only the package name and the file path, then append a counter of the identifiers generated in the file so far. So a release that reorders a file's styles reuses its class names for different rules: `._2mi48t0` is the Button loading overlay in `@sanity/ui` 4.4.2 and the Button root in 4.4.4, and pages that loaded the CSS of both releases styled the new Buttons with the old overlay rule.

`identifiers: 'safe'` is `'short'` with the package version in the file-scope hash: `@emotion/hash(packageName + '@' + packageVersion + filePath)`, followed by the same base-36 counter, with the same `_` prefix when the name starts with a digit. The version is read from the same `package.json` as the package name. Every release gets its own class names, and the same release always builds the same ones. It is available in `@sanity/vanilla-extract-rolldown-plugin`, `@sanity/vanilla-extract-tsdown-plugin`, `@sanity/vanilla-extract-vite-plugin` (including `createCompiler`), and the `vanillaExtract` option of `@sanity/tsdown-config`:

```ts
// tsdown.config.ts
import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  vanillaExtract: {identifiers: 'safe'},
})
```

The defaults are unchanged. `@sanity/vanilla-extract-integration` exports `resolveIdentifierOption()` and the `PluginIdentifierOption` type that implement the option, and `getPackageInfo()` now also returns the package `version`.
