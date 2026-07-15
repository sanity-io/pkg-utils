# @sanity/vanilla-extract-integration

A vendored port of [`@vanilla-extract/integration`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/integration) onto the rolldown toolchain, for the `@sanity/vanilla-extract-*` plugins. Same API for the surface they consume, none of the babel/esbuild machinery:

| Upstream                                                                                                        | Here                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `compile()` bundles `.css.ts` graphs with an **esbuild** child compilation                                      | a **rolldown** child compilation (in-memory, CommonJS, lazy-loaded)                                                                 |
| debug IDs injected by **babel** (`@vanilla-extract/babel-plugin-debug-ids` + `@babel/plugin-syntax-typescript`) | an AST pass over [`rolldown/parseAst`](https://rolldown.rs)'s **oxc** AST, spliced by offset so untouched code stays byte-identical |
| module evaluation via the **`eval`** package                                                                    | `node:vm.compileFunction` + `node:module.createRequire`                                                                             |
| `find-up`, `dedent`, `mlly` dependencies                                                                        | inlined (walk-up loop, plain strings, vendored `detectSyntax` regexes)                                                              |

The only runtime dependencies left are `rolldown` (which the host toolchain — tsdown, Vite 8, or raw rolldown — ships anyway, so it dedupes), `@vanilla-extract/css`, and `javascript-stringify`.

## API

```ts
import {
  compile, // rolldown child compilation of a .css.ts graph
  cssFileFilter,
  getPackageInfo,
  getSourceFromVirtualCssFile,
  normalizePath,
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

## The parser bench-off

The debug-ID pass is parser-agnostic (one shared walker over the oxc-shaped TS-ESTree AST). `bench/debug-ids.bench.ts` compares `rolldown/parseAst` against [`yuku-parser`](https://github.com/yuku-toolchain/yuku) over a generated corpus of hundreds of realistic `.css.ts` files:

```sh
pnpm --filter @sanity/vanilla-extract-integration bench
# corpus size: VE_BENCH_DEBUG_IDS_FILES=2500 pnpm --filter @sanity/vanilla-extract-integration bench
```

Last measured (2026-07-15, Node 24.18.0, Linux x64, 4-core Intel Xeon; rolldown 1.2.0, yuku-parser 0.6.1): yuku-parser parses ~2x faster (57.6ms vs 117.3ms mean per 500-file corpus pass), but the absolute saving at realistic scale is ~60ms — far below the whole-seconds bar set for shipping an extra native-binding dependency, and the transform only runs per file in `'debug'` mode (dev), never as a corpus pass. So `rolldown/parseAst` ships (zero marginal install weight next to `compile()`'s rolldown dependency) and yuku-parser stays a devDependency of the bench.

## License

MIT — incorporates code from [vanilla-extract](https://github.com/vanilla-extract-css/vanilla-extract) (MIT, Copyright (c) 2021 SEEK) and [mlly](https://github.com/unjs/mlly) (MIT). See [LICENSE](./LICENSE).
