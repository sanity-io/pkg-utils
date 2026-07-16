# Vanilla Extract benchmarks

Opt-in performance comparisons for the Vanilla Extract integrations maintained in this
repository. The workspace uses Vitest 4's Tinybench-backed `bench` API for fixed-sample
measurements and Playwright for browser-observed Vite HMR.

The benchmarks are intentionally not part of the normal test suite or CI. Run them on an idle,
consistent machine and compare results produced with the same lockfile, Node version, fixture
sizes, and sample counts.

## Matrix

Library builds compare each plugin on its intended bundler:

- Rollup with `@vanilla-extract/rollup-plugin`
- Rolldown with `@sanity/vanilla-extract-rolldown-plugin`

Vite 8 compares:

- `vite build` with `@vanilla-extract/vite-plugin`
- `vite build` with `@sanity/vanilla-extract-vite-plugin`
- Vite dev HMR for a direct `.css.ts` edit
- Vite dev HMR for a shared theme edit that invalidates every `.css.ts` importer

The Vite hook-filter suite also holds the number of Vanilla Extract files constant while
increasing the number of reachable, unrelated TypeScript modules. Its untimed diagnostic counts
actual JavaScript entries into each plugin's `resolveId`, `load`, and `transform` hooks. This makes
the Rust-to-JavaScript boundary described in
[vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)
visible independently of wall-clock noise.

The generated fixtures are shaped like production code, not synthetic one-liners: every plain
TS module is a few printed pages of types, tokens, and helpers, every `.css.ts` module is a
comparable volume of themes, variants, keyframes, and nested selector/media blocks, and both
are wired through barrel files — so parsers, per-module transforms (babel/yuku debug IDs), and
the CSS pipeline get realistic work per file.

The library-build comparison runs a variant matrix: baseline (no minify, no target), CSS
minification, syntax downleveling via `target: 'chrome61'`, minify + target combined, and
debug identifiers. The Sanity Rolldown plugin handles minify/target through its own
`lightningcss` options; the official Rollup plugin has no such options, so those variants add
the `lightningcss` post-pass that real-world official pipelines (like `@sanity/pkg-utils`'s
`optimizeCss`) use — complete pipeline against complete pipeline. The generated styles include
an `inset` shorthand so the smoke suite can verify that downleveling actually happened
(chrome61 predates `inset`).

The `debug identifiers` variant (also run for the Vite build) exercises the per-module
debug-ID source transform that `identifiers: 'short'` skips entirely: babel
(`@vanilla-extract/babel-plugin-debug-ids`) in the official `@vanilla-extract/integration`
pipeline, a `yuku-parser` AST pass in `@sanity/vanilla-extract-integration`. Comparing
`debug − short` within one side isolates the debug-ID transform cost from everything else that
differs between the pipelines. Minify/target aren't crossed with `debug`: they run after
extraction and are orthogonal to the per-module transform being measured.

The build-suite fixtures are sized like production source files, not synthetic one-liners:
plain modules are roughly 3-4 printed pages of product-shaped code (tokens, helpers, a
reducer, a service class), and `.css.ts` modules carry the themes, variants, keyframes, and
nested selector/media blocks of real-world stylesheet modules — so parsers, per-module
transforms, and the CSS pipeline process realistic volume, and the barrel indexes aggregate
realistic graph volume. Two suites intentionally keep the original near-empty modules: dev HMR
(whose edit markers rely on the simple leaf shape, and where per-edit work is what's measured)
and the hook-filter sweep (which isolates the per-module Rust ↔ JS hook boundary, best
observed without parse noise).

The Vite build comparison intentionally skips the minify/target variants: Vite handles minify
and target itself, identically for either plugin, so varying them would only add identical work
to both sides of the comparison. The exception is the kitchen-sink case, which builds an
app-scale graph (5,000 unrelated TS modules + 500 `.css.ts` modules by default) with
dev-default debug identifiers and a production CSS pipeline (`build.cssMinify` +
`build.cssTarget: 'chrome61'`) — the scenario where the per-module debug-ID transform dominates
the plugin's share of the build.

Each benchmark process lazy-loads only the plugin under test — the competing implementation is
never imported into the same process, so module-level state cannot cross-contaminate runs.

## Latest results

Keep this section current: re-run the full suite and update the tables whenever the
`vanilla-extract` dependencies are bumped or any of the `@sanity/vanilla-extract-*` plugins
change (see [AGENTS.md](../../AGENTS.md)).

Last run: 2026-07-16 (after pinning Node resolve conditions in
`@sanity/vanilla-extract-vite-plugin`'s compiler server — the GH-3073 fix, no measurable
build-time shift expected or observed — with every rolldown copy now on the 1.2.0 that vite
8.1.5 pins), full default suite (`pnpm benchmark:vanilla-extract`) on Node.js 24.18.0, Linux
x64, Intel Xeon, **4 cores**; Rollup 4.62.2, Rolldown 1.2.0, Vite 8.1.5, Vitest 4.1.10,
yuku-parser 0.6.4. Values are mean wall-clock milliseconds from that runner and are
machine-specific — compare ratios, not absolute numbers. (The previous run's prediction for
the rolldown 1.2.0 bump held: the library-build gap widened from 2.65–2.76x to 2.87–2.99x on
the short-identifier variants.)

### Core count shifts the build ratios

Rolldown parallelizes its work across cores in Rust, while Rollup's JavaScript pipeline is
largely single-threaded — so the more cores the machine has, the faster the Rolldown side gets
relative to Rollup, and the tables below (from a 4-core runner) understate the gap on typical
developer hardware. The versions table printed with every run includes the core count so results
stay comparable.

For cross-hardware reference, an Apple M4 Max (16 cores, darwin-arm64, 2026-07-16, the same
production-shaped fixtures but the previous run's Rolldown 1.1.5 / Vite 8.1.4) measured:
library build 2.02–2.18x (short-identifier variants) and 2.47x (debug identifiers, 798ms vs
323ms) in favor of Rolldown + the Sanity plugin; Vite build 1.28x/1.58x (short/debug
identifiers) and 1.48x on the kitchen-sink case (2,757ms vs 1,862ms); dev HMR a wash (1.12x
Sanity on leaf edits, 1.05x official on theme edits, rme up to ±20%); hook-filter stress
1.37–1.71x.

### Library build, 500 TS + 100 CSS modules (5 samples each)

| Variant                  | Rollup + `@vanilla-extract/rollup-plugin` | Rolldown + `@sanity/vanilla-extract-rolldown-plugin` | Relative result     |
| ------------------------ | ----------------------------------------: | ---------------------------------------------------: | ------------------- |
| No minify, no target     |                               1,060.27 ms |                                            354.90 ms | Sanity 2.99x faster |
| Minify                   |                               1,057.25 ms |                                            368.74 ms | Sanity 2.87x faster |
| Target chrome61          |                               1,067.24 ms |                                            371.69 ms | Sanity 2.87x faster |
| Minify + target chrome61 |                               1,068.42 ms |                                            370.25 ms | Sanity 2.89x faster |
| Debug identifiers        |                               1,339.04 ms |                                            419.54 ms | Sanity 3.19x faster |

Debug identifiers cost each pipeline `debug − baseline`: **+278.8 ms** for the official
babel-based transform, **+64.6 ms** for the Sanity `yuku-parser` pass — the transform runs
once per `.css.ts` module and scales with file size, so the production-shaped modules widen
the gap the near-empty fixtures used to understate.

### Vite build, 500 TS + 100 CSS modules (5 samples each)

| Identifiers | `@vanilla-extract/vite-plugin` | `@sanity/vanilla-extract-vite-plugin` | Relative result     |
| ----------- | -----------------------------: | ------------------------------------: | ------------------- |
| Short       |                      940.70 ms |                             740.58 ms | Sanity 1.27x faster |
| Debug       |                    1,237.05 ms |                             813.99 ms | Sanity 1.52x faster |

### Vite build kitchen sink, 5,000 TS + 500 CSS modules, debug identifiers, css minify + target chrome61 (5 samples each)

| `@vanilla-extract/vite-plugin` | `@sanity/vanilla-extract-vite-plugin` | Relative result     |
| -----------------------------: | ------------------------------------: | ------------------- |
|                    4,263.46 ms |                           3,203.07 ms | Sanity 1.33x faster |

### Vite dev HMR (10 samples each)

| Scenario                               | Official plugin | Sanity plugin | Relative result       |
| -------------------------------------- | --------------: | ------------: | --------------------- |
| Single `.css.ts` leaf edit             |        19.39 ms |      22.11 ms | Official 1.14x faster |
| Shared theme edit, 100 style importers |       156.25 ms |     165.64 ms | Official 1.06x faster |

### Hook-filter stress, `vite build` with 1 CSS module (3 samples each)

| Unrelated modules | Official plugin | Sanity plugin | Relative result     |
| ----------------: | --------------: | ------------: | ------------------- |
|                 0 |       417.27 ms |     240.41 ms | Sanity 1.74x faster |
|             1,000 |       426.57 ms |     253.74 ms | Sanity 1.68x faster |
|             5,000 |       605.06 ms |     386.79 ms | Sanity 1.56x faster |

The untimed hook diagnostic shows why: the official plugin's unfiltered hooks enter JavaScript
once per module, while the Sanity plugin's native hook filters reject unrelated ids before the
Rust ↔ JS boundary.

| Unrelated modules | Official `load` / `transform` entries | Sanity `load` / `transform` entries |
| ----------------: | ------------------------------------: | ----------------------------------: |
|                 0 |                                 6 / 8 |                               1 / 1 |
|             1,000 |                         1,006 / 1,008 |                               1 / 1 |
|             5,000 |                         5,006 / 5,008 |                               1 / 1 |

## Running

Use Node.js 24, install dependencies at the repository root, then run:

```sh
pnpm benchmark:vanilla-extract
```

Run one group:

```sh
pnpm benchmark:build
pnpm benchmark:vite-build
pnpm benchmark:vite-hooks
pnpm benchmark:vite-hmr
```

HMR requires a one-time Chromium install:

```sh
pnpm --filter @benchmarks/vanilla-extract install-browser
```

Check every build configuration without collecting timing samples:

```sh
pnpm --filter @benchmarks/vanilla-extract smoke
```

Each benchmark command rebuilds the local Sanity plugins and regenerates fixtures before
starting. It also prints the exact runtime, CPU, bundler, and plugin versions.

## What is timed

Build samples invoke the real local CLI binary in a fresh Node process and write output to disk.
Removing the previous output and validating the next output happen outside the timed region.
Declarations and sourcemaps are disabled; all cases use ESM output over the same generated
source graph, with identifiers, minification, and targets per the variant matrix.

HMR servers and browser pages are started and primed before sampling. A sample begins with an
actual source-file write and ends only after both conditions are true in Chromium:

1. Vite's client has emitted `vite:afterUpdate`.
2. The probe element's computed style contains the new value.

An unexpected page reload or a stale style causes the sample to fail instead of recording a
misleading duration.

The hook-filter stress suite reports absolute build time and handler-entry counts. Rolldown's
default `[PLUGIN_TIMINGS]` warning is surfaced when emitted, but it is not an assertion: the
warning requires a build longer than three seconds, a plugin longer than one second, and
plugin-dominated execution, so whether it appears depends on the host.

## Configuration

All values are optional:

| Variable                     |              Default | Purpose                                             |
| ---------------------------- | -------------------: | --------------------------------------------------- |
| `VE_BENCH_MODULES`           |                `500` | Ordinary modules in the representative graph        |
| `VE_BENCH_STYLES`            |                `100` | `.css.ts` modules in the representative graph       |
| `VE_BENCH_HEAVY_MODULES`     |               `5000` | Ordinary modules in the kitchen-sink graph          |
| `VE_BENCH_HEAVY_STYLES`      |                `500` | `.css.ts` modules in the kitchen-sink graph         |
| `VE_BENCH_HMR_MODULES`       | representative value | Ordinary modules loaded by each HMR server          |
| `VE_BENCH_HMR_STYLES`        | representative value | `.css.ts` importers invalidated by shared-theme HMR |
| `VE_BENCH_STRESS_SIZES`      |        `0,1000,5000` | Ordinary-module counts in the hook-filter sweep     |
| `VE_BENCH_BUILD_ITERATIONS`  |                  `5` | Samples per normal build case                       |
| `VE_BENCH_STRESS_ITERATIONS` |                  `3` | Samples per hook-filter build case                  |
| `VE_BENCH_HMR_ITERATIONS`    |                 `10` | Samples per HMR case                                |
| `VE_BENCH_WARMUP_ITERATIONS` |                  `1` | Untimed warmup samples per case                     |
| `VE_BENCH_HMR_SETTLE`        |                `250` | Untimed milliseconds between source edits           |
| `VE_BENCH_HMR_TIMEOUT`       |              `30000` | Milliseconds before an HMR sample fails             |

For a quick wiring check:

```sh
VE_BENCH_MODULES=10 \
VE_BENCH_STYLES=3 \
VE_BENCH_STRESS_SIZES=0,20 \
VE_BENCH_BUILD_ITERATIONS=1 \
VE_BENCH_STRESS_ITERATIONS=1 \
VE_BENCH_HMR_ITERATIONS=1 \
pnpm benchmark:vanilla-extract
```

Generated fixtures and build outputs live in `.generated/`. Hook diagnostics are written to
`results/vite-hook-counts.json`. Both directories are ignored by Git.
