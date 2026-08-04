---
'@sanity/pkg-utils': major
---

**v12: the build now runs on [`tsdown`](https://tsdown.dev)**, composed with [`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#readme) — replacing the old rollup (JS) + rolldown (types) + api-extractor (more types) + esbuild (checks) stack. Your hand-written `exports` map stays the input. Closes [#2301](https://github.com/sanity-io/pkg-utils/issues/2301).

**Most packages build unchanged.** If yours doesn't, the error tells you exactly what to change — and the full guide is in [MIGRATE.md](https://github.com/sanity-io/pkg-utils/blob/main/packages/@sanity/pkg-utils/MIGRATE.md).

### What you get

- **~2x faster builds** — one bundler does JS + types in one pass.
- **`exports` can't drift** — local builds regenerate the exports map (and `publishConfig.exports`) from the build; CI uses the committed `package.json` as-is.
- **`pkg check` runs [publint](https://publint.dev)** on the packed package, so it lints what consumers actually install (replaces the esbuild resolution checks). API Extractor stays for TSDoc/release-tag checking only — new `tsdoc` option.
- **Chunks are content-hashed** — a shared chunk can never take an entry's filename anymore ([sanity-io/ui#2262](https://github.com/sanity-io/ui/issues/2262)). The `_chunks-[format]` folders are gone.
- **`dist` is cleaned automatically** before every build and on watch rebuilds. Opt out with `clean: false` (config) or `pkg build --no-clean` (one run); the v11 `--clean` flag still parses as a no-op.

### Breaking: config options

Removed options **fail the build with copy-pasteable migration instructions** (checks are skipped when `NODE_ENV=production`, or with `legacyChecks: false`):

| v11                                 | v12                                                             |
| ----------------------------------- | --------------------------------------------------------------- |
| `dts: 'rolldown'`                   | delete it — it's the default now                                |
| `dts: 'api-extractor'`              | delete it — tsdown generates the types                          |
| `tsgo: true`                        | `dts: {tsgo: true}`                                             |
| `babel: {reactCompiler: true}`      | `reactCompiler: true`                                           |
| `reactCompilerOptions: {...}`       | `reactCompiler: {...}`                                          |
| `babel: {styledComponents: true}`   | `styledComponents: true` — oxc-native, uninstall the Babel plugin |
| `babel: {plugins: [...]}`           | `plugins` + a self-installed `@rolldown/plugin-babel`           |
| `rollup: {vanillaExtract: true}`    | `vanillaExtract: true`                                          |
| `rollup: {plugins: [...]}`          | `plugins: [...]` — rolldown plugins; most Rollup plugins work   |
| `rollup: {optimizeLodash: true}`    | removed — drop lodash or import from `lodash-es`                |
| `extract: {enabled: false}`         | `tsdoc: false`                                                  |
| `extract: {rules, customTags}`      | `tsdoc: {rules, customTags}`                                    |
| `extract: {bundledPackages: [...]}` | `deps: {alwaysBundle: [...]}`                                   |
| `jsx`, `jsxFactory`, …              | `tsconfig.json` `compilerOptions.jsx` and friends               |

`external` is only **deprecated** — it keeps working (with a warning). Successors: `deps: {neverBundle: [...]}` and `deps: {alwaysBundle: [...]}`. A few niche options have no successor (`rollup.output`, `rollup.treeshake`, `extract.checkTypes`, the implicit lodash optimization) — see [MIGRATE.md](https://github.com/sanity-io/pkg-utils/blob/main/packages/@sanity/pkg-utils/MIGRATE.md).

### Breaking: `PKG_*` constants

Only `process.env.PKG_VERSION` is still replaced at build time.

- `PKG_FORMAT`, `PKG_RUNTIME` → [conditional `package.json#imports`](https://nodejs.org/api/packages.html#imports). More precise, and conditions compose (`require`/`import`, `node`/`browser`/`worker`, `deno`, `react-server`, …). Worked examples: [MIGRATE.md](https://github.com/sanity-io/pkg-utils/blob/main/packages/@sanity/pkg-utils/MIGRATE.md#pkg_format-and-pkg_runtime).
- `PKG_FILE_PATH` → `import.meta.url`. Works in CJS output too — it's rewritten to `require("url").pathToFileURL(__filename).href`.

### Breaking: environment

- **Node 20 can no longer run builds**: `engines.node` is `^22.18.0 || >=24.11.0` (tsdown's floor). The published output is unaffected.
- `tsdown.config.*` files are **never** loaded by `pkg build` — `package.config.ts` is the only config source (a warning points this out when one is found).
- Dependency swap: `rollup` + all `@rollup/*` plugins, `rolldown`, `rolldown-plugin-dts`, `esbuild` and all Babel packages are out; `tsdown`, `@sanity/tsdown-config` and `publint` are in.
