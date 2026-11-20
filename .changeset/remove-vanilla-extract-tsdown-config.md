---
'@sanity/tsdown-config': minor
---

Remove the `vanillaExtract` option.

**BREAKING:** the `vanillaExtract` option and the `PackageVanillaExtractOptions` type are gone, and `@sanity/vanilla-extract-tsdown-plugin` is no longer a dependency. `defineConfig()` throws when `vanillaExtract` is set. To keep using vanilla-extract, append one of its own bundler plugins, for example `vanillaExtractPlugin()` from `@vanilla-extract/rollup-plugin`, to the `plugins` of the config `defineConfig()` returns (see the README), or move the styles to the `css` or `panda` options, which keep the conditional CSS export. `CssExportsOptions` is still exported.
