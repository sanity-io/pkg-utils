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

The Vite build comparison intentionally skips the minify/target variants: Vite handles minify
and target itself, identically for either plugin, so varying them would only add identical work
to both sides of the comparison.

Each benchmark process lazy-loads only the plugin under test — the competing implementation is
never imported into the same process, so module-level state cannot cross-contaminate runs.

## Latest results

Keep this section current: re-run the full suite and update the tables whenever the
`vanilla-extract` dependencies are bumped or any of the `@sanity/vanilla-extract-*` plugins
change (see [AGENTS.md](../../AGENTS.md)).

Last run: 2026-07-15 (after vendoring `@vanilla-extract/integration` onto rolldown as
`@sanity/vanilla-extract-integration` — the library-build compile path swapped its esbuild
child compilation for rolldown, and debug IDs swapped babel for a `yuku-parser` AST pass —
and after adding the `debug identifiers` variant to this suite), full default suite
(`pnpm benchmark:vanilla-extract`) on Node.js 24.18.0, Linux x64, Intel Xeon, **4 cores**;
Rollup 4.62.2, Rolldown 1.2.0, Vite 8.1.4, Vitest 4.1.10, yuku-parser 0.6.1. Values are mean
wall-clock milliseconds from that runner and are machine-specific — compare ratios, not
absolute numbers.

### Core count shifts the build ratios

Rolldown parallelizes its work across cores in Rust, while Rollup's JavaScript pipeline is
largely single-threaded — so the more cores the machine has, the faster the Rolldown side gets
relative to Rollup, and the tables below (from a 4-core runner) understate the gap on typical
developer hardware. The versions table printed with every run includes the core count so results
stay comparable.

For reference, an earlier run of the same suite on an Apple M4 Max (16 cores, darwin-arm64) —
before the integration was vendored onto rolldown, when the Sanity library build still ran the
esbuild-based `compile()` — measured the library build at 2.68x (baseline) and up to ~4x
(minify) in favor of Rolldown + the Sanity plugin, against the 1.56–1.67x that same
pre-vendoring pipeline measured on the 4-core runner, while the Vite build ratio stayed put at
~1.33x (Vite's pipeline dominates there, identically for both plugins). The high-variance rows
of that run (rme up to ±70% on the Rollup side) mean the exact multiplier is fuzzy, but the
direction is consistent: more cores widen the library-build gap.

### Library build, 500 TS + 100 CSS modules (5 samples each)

| Variant                  | Rollup + `@vanilla-extract/rollup-plugin` | Rolldown + `@sanity/vanilla-extract-rolldown-plugin` | Relative result     |
| ------------------------ | ----------------------------------------: | ---------------------------------------------------: | ------------------- |
| No minify, no target     |                                 574.04 ms |                                            230.77 ms | Sanity 2.49x faster |
| Minify                   |                                 578.32 ms |                                            239.82 ms | Sanity 2.41x faster |
| Target chrome61          |                                 570.37 ms |                                            236.29 ms | Sanity 2.41x faster |
| Minify + target chrome61 |                                 562.52 ms |                                            236.50 ms | Sanity 2.38x faster |
| Debug identifiers        |                                 696.77 ms |                                            250.02 ms | Sanity 2.79x faster |

Debug identifiers cost each pipeline `debug − baseline`: **+122.7 ms** for the official
babel-based transform, **+19.3 ms** for the Sanity `yuku-parser` pass — the transform runs once
per `.css.ts` module, so the gap scales with style-module count.

### Vite build, 500 TS + 100 CSS modules (5 samples each)

| Identifiers | `@vanilla-extract/vite-plugin` | `@sanity/vanilla-extract-vite-plugin` | Relative result     |
| ----------- | -----------------------------: | ------------------------------------: | ------------------- |
| Short       |                      721.36 ms |                             511.56 ms | Sanity 1.41x faster |
| Debug       |                      877.95 ms |                             541.72 ms | Sanity 1.62x faster |

### Vite dev HMR (10 samples each)

| Scenario                               | Official plugin | Sanity plugin | Relative result       |
| -------------------------------------- | --------------: | ------------: | --------------------- |
| Single `.css.ts` leaf edit             |        20.88 ms |      21.38 ms | Official 1.02x faster |
| Shared theme edit, 100 style importers |       156.71 ms |     164.65 ms | Official 1.05x faster |

### Hook-filter stress, `vite build` with 1 CSS module (3 samples each)

| Unrelated modules | Official plugin | Sanity plugin | Relative result     |
| ----------------: | --------------: | ------------: | ------------------- |
|                 0 |       415.56 ms |     241.82 ms | Sanity 1.72x faster |
|             1,000 |       442.57 ms |     245.96 ms | Sanity 1.80x faster |
|             5,000 |       632.93 ms |     389.33 ms | Sanity 1.63x faster |

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
Minification, declarations, and sourcemaps are disabled; all cases use ESM output and short
identifiers over the same generated source graph.

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
