---
"@sanity/tsdown-config": minor
"@sanity/vanilla-extract-tsdown-plugin": minor
"@sanity/parse-package-json": patch
"@sanity/pkg-utils": major
"@sanity/vanilla-extract-integration": patch
"@sanity/vanilla-extract-rolldown-plugin": patch
"@sanity/vanilla-extract-vite-plugin": patch
---

Upgrade tsdown and `@tsdown/css` to 0.23.

**BREAKING:** the `@sanity/tsdown-config` and `@sanity/vanilla-extract-tsdown-plugin`
`tsdown` peer range is now `^0.23.0`; tsdown 0.22 is no longer supported. Node.js 25
can no longer run either package or `pkg build`. Use Node `^22.18.0`, `^24.11.0`, or
`>=26.0.0`.

tsdown 0.23 removes deprecated config options. Replace `dts.tsgo: true` and
`dts.oxc: true` with `dts.generator: 'tsgo'` and `dts.generator: 'oxc'`.
Replace `dts.oxc: false` with `dts.generator: 'tsc'`. Remove `dts.cjsReexport`.
Replace `dts.volarPlugins` with `dts.customLanguages` and rename each language's
`create` hook to `createVolarPlugins`.
Under `deps`, replace `skipNodeModulesBundle: true` with `neverBundle: true`
and `onlyAllowBundle` with `onlyBundle`.

`deps.resolveDepSubpath: true` preserves the old dependency-specifier behavior.
`pkg watch` now closes tsdown's native watch handle, including its Rolldown watchers
and keyboard-shortcut resources, and sets `ignoreWatch` on `package.json` and
`tsconfig.json` so tsdown does not restart itself and orphan a watcher that abort
cannot close. CSS builds now need `@tsdown/css@0.23.0`, the exact version tsdown 0.23
pins.

tsdown 0.23 also emits declarations with inline `export declare` modifiers instead of
a trailing export list. A `.d.ts` with no export statement is an export context, so a
type that the source left unexported becomes part of the published API. Export the
types you mean to publish and tag them `@public`.
