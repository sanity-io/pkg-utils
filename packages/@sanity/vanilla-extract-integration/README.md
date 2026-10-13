# @sanity/vanilla-extract-integration

A vendored port of [`@vanilla-extract/integration`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/integration) onto the rolldown toolchain, for the `@sanity/vanilla-extract-*` plugins. Same API for the surface they consume, none of the babel/esbuild machinery:

| Upstream                                                                                                        | Here                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `compile()` bundles `.css.ts` graphs with an **esbuild** child compilation                                      | a **rolldown** child compilation (in-memory, CommonJS, lazy-loaded)                                                           |
| debug IDs injected by **babel** (`@vanilla-extract/babel-plugin-debug-ids` + `@babel/plugin-syntax-typescript`) | an AST pass over [`yuku-parser`](https://yuku.fyi)'s oxc-shaped AST, spliced by offset so untouched code stays byte-identical |
| module evaluation via the **`eval`** package                                                                    | `node:vm.compileFunction` + `node:module.createRequire`                                                                       |
| `find-up`, `dedent`, `mlly` dependencies                                                                        | inlined (walk-up loop, plain strings, vendored `detectSyntax` regexes)                                                        |

The only runtime dependencies left are `rolldown` (which the host toolchain — tsdown, Vite 8, or raw rolldown — ships anyway; the wide `^1.1.5` range lets package managers reuse the host's copy when its version satisfies it, though hosts pinning older minors can still resolve a second copy), `yuku-parser` (already transitive in rolldown-based toolchains through `rolldown-plugin-dts`), `@vanilla-extract/css`, and `javascript-stringify`.

## API

```ts
import {
  compile, // rolldown child compilation of a .css.ts graph
  createAdapterIdentOption, // identifier option for a compilation adapter (bare package name for custom functions)
  createFileScopePackageName, // `<name>@<version>+<source digest>`, the package name of a file scope
  cssFileFilter,
  getPackageInfo,
  getSourceFromVirtualCssFile,
  normalizePath,
  parseFileScopePackageName,
  processVanillaFile, // evaluate compiled output into virtual CSS imports + serialized exports
  serializeVanillaModule,
  transform, // debug IDs + file scope wrapping for a single module
  virtualCssFileFilter,
  type IdentifierOption,
} from '@sanity/vanilla-extract-integration'
```

Intentional differences from upstream:

- The `esbuildOptions` bag of `compile()` is dropped (it leaked the esbuild API into the public surface).
- Only the API surface consumed by `@sanity/vanilla-extract-rolldown-plugin` and `@sanity/vanilla-extract-vite-plugin` is exported.
- The babel-compiled `createTheme` destructure special-cases of the debug-ID transform are not ported: the transform only ever sees authored source.
- File scopes are qualified with the package version and a digest of the module source, so identifiers are unique per package build (see below). Upstream hashes the bare package name.

## Identifiers are unique per package version

`@vanilla-extract/css` derives every identifier it generates — class names, keyframes, CSS vars, containers, layers — from `hash(packageName + filePath)` followed by a per-file call counter (`_2mi48t0`, `_2mi48t1`, …). Upstream sets the file scope's `packageName` to the bare package name, so a `.css.ts` module gets the **same identifiers in every version of the package**. Once a style is added, removed or reordered, the counter shifts and a class name that used to select one rule selects another. When two versions of the same library are loaded on one page (an app bundling its own `@sanity/ui` next to a Studio loaded from the module CDN, a Studio plugin bundling a different `@sanity/ui` than the Studio) the stylesheets style each other's markup with the wrong rules: in `@sanity/ui` ≤ 4.4.2 `_2mi48t0` was the Button's loading overlay (`position: absolute; inset: 0`), in 4.4.4 it became the Button's root class, and every Button turned into an opaque box.

`transform()` therefore sets the file scope's package name to `createFileScopePackageName({name, version, source})`: the package name qualified by its version (`0.0.0` when the `package.json` has none) and an 8-hex-char digest of the module source, e.g. `@sanity/ui@4.4.4+1f3a9c2e`. `compile()` and `@sanity/vanilla-extract-vite-plugin`'s compiler feed it the `version` resolved by `getPackageInfo()`.

- **Unique across versions and content.** Every published version of a package gets its own identifiers; so do builds of the same version with different styles (local or preview builds), and packages without a version.
- **Deterministic.** The same package name, version and module source always produce the same identifiers, wherever the package is built. A shared `theme.css.ts` gets the same identifiers whether it's evaluated through an importer or on its own.
- **As short as before.** The hash output has a fixed 32-bit width (`@emotion/hash`, base36 encoded), so the identifiers don't grow with the richer input.
- **Custom identifier functions keep working.** They receive the bare `packageName` (through `createAdapterIdentOption`), while the qualified file scope already feeds into the `hash` they receive. The same goes for the `fileScope` handed to `processVanillaFile`'s `serializeVirtualCssPath`.

The remaining difference to upstream is the hash itself, which the Sanity Studio integration suite (`integration/vanilla-extract-studio`) accounts for when comparing the fork's output against `@vanilla-extract/vite-plugin`.

## The parser bench-off

The debug-ID pass is parser-agnostic (one shared walker over the oxc-shaped TS-ESTree AST). `bench/debug-ids.bench.ts` compares [`yuku-parser`](https://github.com/yuku-toolchain/yuku) against `rolldown/parseAst` over a generated corpus of hundreds of realistic `.css.ts` files, and the unit tests run every case through both parsers to prove identical output:

```sh
pnpm --filter @sanity/vanilla-extract-integration bench
# corpus size: VE_BENCH_DEBUG_IDS_FILES=2500 pnpm --filter @sanity/vanilla-extract-integration bench
```

Last measured (2026-07-16, Node 24.18.0, Linux x64, 4-core Intel Xeon; rolldown 1.1.5, yuku-parser 0.6.1): yuku-parser parses ~2x faster — 59.7ms vs 121.0ms mean per 500-file corpus pass, 278ms vs 593ms at 2500 files (cold import 9.0ms vs 6.6ms). **yuku-parser ships as the production backend** on that win; it's effectively free dependency-wise since the yuku toolchain is already in the install graph of rolldown-based setups (`rolldown-plugin-dts`, used by tsdown and `@sanity/pkg-utils`, parses with it). `rolldown/parseAst` stays in the bench (rolldown is a dependency regardless, for `compile()`) so the comparison remains reproducible as both parsers evolve.

## License

MIT — incorporates code from [vanilla-extract](https://github.com/vanilla-extract-css/vanilla-extract) (MIT, Copyright (c) 2021 SEEK) and [mlly](https://github.com/unjs/mlly) (MIT). See [LICENSE](./LICENSE).
