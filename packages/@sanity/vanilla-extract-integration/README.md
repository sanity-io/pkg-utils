# @sanity/vanilla-extract-integration

A vendored port of [`@vanilla-extract/integration`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/integration) onto the rolldown toolchain, for the `@sanity/vanilla-extract-*` plugins. Same API for the surface they consume, none of the babel/esbuild machinery:

| Upstream                                                                                                        | Here                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `compile()` bundles `.css.ts` graphs with an **esbuild** child compilation                                      | a **rolldown** child compilation (in-memory, CommonJS, lazy-loaded)                                                           |
| debug IDs injected by **babel** (`@vanilla-extract/babel-plugin-debug-ids` + `@babel/plugin-syntax-typescript`) | an AST pass over [`yuku-parser`](https://yuku.fyi)'s oxc-shaped AST, spliced by offset so untouched code stays byte-identical |
| module evaluation via the **`eval`** package                                                                    | `node:vm.compileFunction` + `node:module.createRequire`                                                                       |
| `find-up`, `dedent`, `mlly` dependencies                                                                        | inlined (walk-up loop, plain strings, vendored `detectSyntax` regexes)                                                        |
| CSS rendered by `@vanilla-extract/css/transformCss`                                                             | a vendored `transformCss` (`src/transformCss/`, byte-identical output) that the atomic pass hooks into                        |
| one child compilation and one `transformCss` per `.css.ts` module                                               | additionally `processVanillaProgram()`: every module of a project compiled, evaluated and rendered once                       |

The only runtime dependencies left are `rolldown` (which the host toolchain — tsdown, Vite 8, or raw rolldown — ships anyway; the wide `^1.1.5` range lets package managers reuse the host's copy when its version satisfies it, though hosts pinning older minors can still resolve a second copy), `yuku-parser` (already transitive in rolldown-based toolchains through `rolldown-plugin-dts`), `@vanilla-extract/css`, and `javascript-stringify`.

## API

```ts
import {
  compile, // rolldown child compilation of a .css.ts graph
  compileProgram, // one child compilation over a set of .css.ts modules (synthetic namespace entry)
  cssFileFilter,
  discoverCssModules, // every .css.ts module under some directories
  evaluateVanillaModule, // run compiled output with a collecting adapter
  getPackageInfo,
  getSourceFromVirtualCssFile,
  normalizePath,
  processVanillaFile, // evaluate compiled output into virtual CSS imports + serialized exports
  processVanillaProgram, // the same for a whole set of modules: one adapter, one stylesheet
  propertiesOverlap, // the CSS property overlap relation the atomic pass is built on
  renderStylesheet, // transformCss plus the atomic pass's class list expansions and report
  serializeVanillaModule,
  transform, // debug IDs + file scope wrapping for a single module
  transformCss, // vendored @vanilla-extract/css/transformCss
  virtualCssFileFilter,
  type IdentifierOption,
} from '@sanity/vanilla-extract-integration'
```

## The atomic pass

`processVanillaFile({atomic: true})` / `processVanillaProgram({atomic: true})` render the
declarations of `style()` rules as shared single-declaration classes and expand the serialized
class lists with them. The pass lives in `src/atomic/`:

- `propertyGroups.ts` — which properties can set the same physical longhand (shorthands from
  `mdn-data` via `scripts/generatePropertyGroups.ts`, hand-written logical ↔ physical groups,
  aliases), cross-checked against StyleX's resolution tables in `test/propertyGroups.test.ts`.
- `atomicPass.ts` — the barrier analysis over the rendering order: identical declarations share a
  class only when no overlapping declaration (same cascade layer, same importance) renders
  between them, which is exactly when sharing cannot change any element's computed styles.
  `test/cascadeEquivalence.test.ts` proves that in Chromium over random style sets.
- `priorities.ts` — StyleX's cascade priority scheme (shorthands below longhands, pseudos and
  at-rules by kind) computed from the same tables, the building block of the planned opt-in
  `atomic: 'priority'` mode that trades order-based overrides for unconditional sharing; see
  [docs/atomic-priority-mode.md](./docs/atomic-priority-mode.md).

The contract, and why it shares less than an atomic CSS framework, is documented in the
[rolldown plugin's README](../vanilla-extract-rolldown-plugin/README.md#atomic-classes).

Intentional differences from upstream:

- The `esbuildOptions` bag of `compile()` is dropped (it leaked the esbuild API into the public surface).
- Only the API surface consumed by `@sanity/vanilla-extract-rolldown-plugin` and `@sanity/vanilla-extract-vite-plugin` is exported.
- The babel-compiled `createTheme` destructure special-cases of the debug-ID transform are not ported: the transform only ever sees authored source.

## The parser bench-off

The debug-ID pass is parser-agnostic (one shared walker over the oxc-shaped TS-ESTree AST). `bench/debug-ids.bench.ts` compares [`yuku-parser`](https://github.com/yuku-toolchain/yuku) against `rolldown/parseAst` over a generated corpus of hundreds of realistic `.css.ts` files, and the unit tests run every case through both parsers to prove identical output:

```sh
pnpm --filter @sanity/vanilla-extract-integration bench
# corpus size: VE_BENCH_DEBUG_IDS_FILES=2500 pnpm --filter @sanity/vanilla-extract-integration bench
```

Last measured (2026-07-16, Node 24.18.0, Linux x64, 4-core Intel Xeon; rolldown 1.1.5, yuku-parser 0.6.1): yuku-parser parses ~2x faster — 59.7ms vs 121.0ms mean per 500-file corpus pass, 278ms vs 593ms at 2500 files (cold import 9.0ms vs 6.6ms). **yuku-parser ships as the production backend** on that win; it's effectively free dependency-wise since the yuku toolchain is already in the install graph of rolldown-based setups (`rolldown-plugin-dts`, used by tsdown and `@sanity/pkg-utils`, parses with it). `rolldown/parseAst` stays in the bench (rolldown is a dependency regardless, for `compile()`) so the comparison remains reproducible as both parsers evolve.

## License

MIT — incorporates code from [vanilla-extract](https://github.com/vanilla-extract-css/vanilla-extract) (MIT, Copyright (c) 2021 SEEK) and [mlly](https://github.com/unjs/mlly) (MIT). See [LICENSE](./LICENSE).
