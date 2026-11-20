---
'@sanity/pkg-utils': major
---

Remove vanilla-extract support.

**BREAKING:** the `vanillaExtract` option and the `PackageVanillaExtractOptions` type are gone, and `pkg build` no longer compiles `.css.ts` files. A `package.config.ts` that still sets `vanillaExtract` fails with a link to the migration notes, even with `legacyChecks: false`.

To migrate, remove `vanillaExtract` from `package.config.ts`, then either:

- keep vanilla-extract and add one of its own bundler plugins to `plugins`, for example `plugins: [vanillaExtractPlugin()]` from `@vanilla-extract/rollup-plugin`. The plugin decides how the CSS is emitted and imported; pkg-utils no longer injects `import "<pkg>/bundle.css"`, emits the `bundle-css.js` shim or writes the `./bundle.css` export for it, or
- move the styles to plain CSS or CSS modules with the `css` option, which keeps the conditional CSS export. `css: {fileName: 'bundle.css'}` keeps the `./bundle.css` subpath.

See [MIGRATE.md](https://github.com/sanity-io/pkg-utils/blob/main/packages/@sanity/pkg-utils/MIGRATE.md#v14-vanilla-extract-support-removed).

The `@sanity/vanilla-extract-integration`, `@sanity/vanilla-extract-rolldown-plugin`, `@sanity/vanilla-extract-tsdown-plugin` and `@sanity/vanilla-extract-vite-plugin` packages are deprecated and no longer maintained.
