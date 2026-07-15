---
'@sanity/vanilla-extract-rolldown-plugin': minor
'@sanity/vanilla-extract-tsdown-plugin': minor
'@sanity/tsdown-config': minor
---

feat: CSS syntax lowering and minification now follow the `css` defaults of `@tsdown/css` exactly, and the `@sanity/browserslist-config` opinion moved up into `@sanity/tsdown-config`:

- `@sanity/vanilla-extract-rolldown-plugin` (and the tsdown plugin wrapping it) no longer depends on `browserslist`/`@sanity/browserslist-config`. Like `css.target` in `@tsdown/css`, syntax lowering is skipped when no `target` is configured anywhere (the option, or the host-resolved top-level `target` — e.g. derived from `engines.node`), or when the configured targets name no browsers (e.g. `'node20'`); `target: false` stays the explicit off switch.
- `minify` now defaults to `false`, matching `css.minify` in `@tsdown/css` (extracted CSS was previously minified by default).
- New `lightningcss` option, like `css.lightningcss` in `@tsdown/css`: options passed through to lightningcss's `transform()`, where `lightningcss.targets` takes precedence over the esbuild-style `target` and the plugin-managed fields (`minify`, `cssModules`) win over their lightningcss counterparts. `esbuildTargetToLightningCSS` is exported for hosts that need to convert or inspect esbuild-style targets.
- `@sanity/tsdown-config` preserves the Sanity-flavored default at its level (and now owns the `browserslist`, `@sanity/browserslist-config`, and `lightningcss` dependencies): when the effective CSS target (`vanillaExtract.target`, falling back to the top-level `target`) is undefined or names no browsers, the lowering targets are resolved from `@sanity/browserslist-config` and passed through `lightningcss.targets`. `target: false` (at either level) disables lowering entirely, and a user-provided `lightningcss.targets` wins over the fallback. Note that `vanillaExtract.minify` now also defaults to `false` — pass `minify: true` to keep shipping minified CSS.
