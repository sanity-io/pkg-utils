---
'@sanity/pkg-utils': major
---

`@sanity/pkg-utils` now composes [`tsdown`](https://tsdown.dev) + [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme) instead of wrapping rollup for JS, rolldown + rolldown-plugin-dts for `.d.ts`, api-extractor for another `.d.ts` path, and esbuild for `--check` resolution. The hand-written `exports` map stays the input; for every platform build (the default, plus one per `browser`/`node` exports condition) pkg-utils resolves a config from `@sanity/tsdown-config`, layers its opinions over it with tsdown's `mergeConfig` (browserslist-driven syntax targets, `PKG_*` constants, exports reconciliation), and runs tsdown's programmatic `build()` — variants first, the canonical build last. Closes [#2301](https://github.com/sanity-io/pkg-utils/issues/2301).

Highlights:

- **~2x faster builds** with a single bundler doing JS and types in one pass.
- **exports stay in sync**: local builds regenerate the `exports` map from the build (with the `source`-condition development pattern via tsdown's `devExports`) and maintain `publishConfig.exports`; CI uses the committed `package.json` as-is.
- **publint replaces the esbuild resolution checks** of `pkg check`/`--check`: the package is packed (applying `publishConfig`) and linted the way consumers see it. api-extractor remains as TSDoc/release-tag checking only, configured with the new `tsdoc` option.
- **tsdown owns cleaning**: `dist` is cleaned before every build by default (the `--clean` flag is a deprecated no-op; opt out with `clean: false`), and watch mode cleans stale chunks on rebuilds.
- **Shared chunks are content-hashed** (`_chunks-[format]` folders and `rollup.hashChunkFileNames` are gone), so a chunk can never take an entry's filename ([sanity-io/ui#2262](https://github.com/sanity-io/ui/issues/2262)).
- `tsdown.config.*` files are never loaded by `pkg build` (`package.config.ts` is the sole config source) — a warning points this out when one is found.

Breaking changes (removed options throw an error with copy-pasteable migration instructions, gated by the new `legacyChecks` option, defaulting to `NODE_ENV !== 'production'`):

- `dts: 'api-extractor' | 'rolldown'` — removed; tsdown generates the types. `tsgo` moves to `dts: {tsgo: true}` (the `dts` option is now a tsdown passthrough).
- `babel.reactCompiler`/`reactCompilerOptions` → top-level `reactCompiler`; `babel.styledComponents` → top-level `styledComponents` (oxc's native port — `babel-plugin-styled-components` can be uninstalled); `babel.plugins` → the new `plugins` option with a self-installed `@rolldown/plugin-babel`.
- `rollup.vanillaExtract` → top-level `vanillaExtract`; `rollup.plugins` → `plugins` (rolldown plugins; most Rollup plugins are compatible); `rollup.output`/`treeshake`/`experimentalLogSideEffects`/`hashChunkFileNames` have no successor.
- `rollup.optimizeLodash` and the implicit lodash-import optimization are removed — prefer dropping lodash (see [e18e.dev](https://e18e.dev)) or importing from `lodash-es`.
- `extract` → `tsdoc` for the retained TSDoc check; `extract.bundledPackages` follows the bundling decisions now (`deps: {alwaysBundle: [...]}`); `extract.checkTypes` has no successor.
- `external` is deprecated (still functional, mapped onto `deps` with a warning) — use `deps: {neverBundle}` / `deps: {alwaysBundle}`.
- `jsx`/`jsxFactory`/`jsxFragment`/`jsxImportSource` — configure JSX through `tsconfig.json`.
- `process.env.PKG_FORMAT` and `process.env.PKG_FILE_PATH` are no longer replaced at build time (`PKG_RUNTIME`/`PKG_VERSION` still are) — use conditional [`package.json#imports`](https://nodejs.org/api/packages.html#imports) and `import.meta.url` instead.
- **Node 20 support is dropped**: `engines.node` is now `^22.18.0 || >=24.11.0` (matching tsdown; the published output is unaffected). chalk was updated to v6 accordingly.
- Dependencies: `rollup`, all `@rollup/*` plugins, `rollup-plugin-esbuild`, `@vanilla-extract/rollup-plugin`, `rolldown`, `rolldown-plugin-dts`, `esbuild` and all Babel packages are gone; `tsdown`, `@sanity/tsdown-config` and `publint` are in.
