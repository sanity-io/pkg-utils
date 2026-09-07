---
"@sanity/tsdown-config": patch
"@sanity/vanilla-extract-tsdown-plugin": patch
"@sanity/parse-package-json": patch
"@sanity/pkg-utils": major
"@sanity/vanilla-extract-integration": patch
"@sanity/vanilla-extract-rolldown-plugin": patch
"@sanity/vanilla-extract-vite-plugin": patch
---

Upgrade tsdown and `@tsdown/css` to 0.23.

**BREAKING (`@sanity/pkg-utils`):** Node.js 25 can no longer run the build. Use Node
`^22.18.0`, `^24.11.0`, or `>=26.0.0`.

tsdown 0.23 removes deprecated config options. Replace `dts.tsgo: true` and
`dts.oxc: true` with `dts.generator: 'tsgo'` and `dts.generator: 'oxc'`.
Replace `dts.oxc: false` with `dts.generator: 'tsc'`. Remove `dts.cjsReexport`.
Under `deps`, replace `skipNodeModulesBundle: true` with `neverBundle: true`
and `onlyAllowBundle` with `onlyBundle`.

The `@sanity/tsdown-config` and `@sanity/vanilla-extract-tsdown-plugin` peer
ranges still accept tsdown 0.22. `deps.resolveDepSubpath: true` preserves the
old dependency-specifier behavior. `pkg watch` now closes tsdown's native watch
handle, including its Rolldown watchers and keyboard-shortcut resources.
