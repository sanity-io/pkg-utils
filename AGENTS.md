# AGENTS.md

## Cursor Cloud specific instructions

This is the `@sanity/pkg-utils` monorepo: a pnpm workspace containing a build/tooling CLI for
authoring npm packages (`packages/@sanity/pkg-utils`, wraps rolldown/rollup + API Extractor),
supporting packages (`tsdown-config`, `tsconfig`, `parse-package-json`, the
`vanilla-extract-*-plugin` packages), a `playground/*` fixture suite (~30 packages exercising
build/typecheck scenarios), and a `css-playground/*` fixture suite (~20 packages verifying the
conditional `bundle.css` export pattern across many frameworks/runtimes). There is **no
long-running application/database** in this repo — it's a CLI/build-tool product; "running the
product" means running its build/lint/test/typecheck commands (see root `package.json` `scripts`
and `.github/workflows/main.yml` for the canonical commands, e.g. `pnpm build`, `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm knip`, `pnpm playground:build`/`:typecheck`,
`pnpm css-playground:build`/`:test`; `css-playground/README.md` documents that suite in detail).

### Node version matters (tsdown requires Node ^22.18.0 || >=24.11.0)

`tsdown` (used to build every `@sanity/*` package) needs Node `^22.18.0 || >=24.11.0` for its
native TypeScript config-loading; on an older Node it fails with `Failed to import module "unrun"`.
The sandbox's default system Node (`/exec-daemon/node`, v22.14.0) does **not** satisfy this. Fix:
Node is managed via `nvm`, with the default alias set to `24` (Node v24.18.0 LTS, "Krypton" —
matching CI's `node-version: lts/*`) and `pnpm@10.34.4` (matching the root `packageManager` field)
installed globally under that Node version. A normal login shell (`bash -l`, which sources
`~/.bashrc`) picks this up automatically via nvm's own auto-`use`-default-on-source behavior — no
manual `nvm use` should be necessary. `deno` (`~/.deno/bin`, pinned to v2.9.2 to match CI) and `bun`
(`~/.bun/bin`, latest, matching CI) are also installed and on `PATH` via `~/.bashrc`, needed only by
the two optional `css-playground/deno` and `css-playground/bun` smoke tests.

If a shell ever shows the wrong Node version (e.g. `node -v` reports `v22.14.0`/`/exec-daemon/node`
or pnpm/deno/bun are "command not found"), run `nvm use 24` (or open a fresh login shell) to fix it
for that session — `nvm`'s "current" version is sticky per-shell once explicitly set and won't
retroactively follow later `nvm alias default` changes.

### Vanilla Extract benchmarks must stay current

`benchmarks/vanilla-extract` is an opt-in performance suite comparing the
`@sanity/vanilla-extract-*` plugins against the official `@vanilla-extract/*` plugins, and its
README publishes the latest measured results (which the plugin READMEs link to). **Whenever you
bump any `vanilla-extract` dependency (`@vanilla-extract/*` packages, or the pinned
`@vanilla-extract/rollup-plugin`/`@vanilla-extract/vite-plugin` dev dependencies of the benchmark
workspace), or change any of the `@sanity/vanilla-extract-rolldown-plugin`,
`@sanity/vanilla-extract-tsdown-plugin`, or `@sanity/vanilla-extract-vite-plugin` packages in any
way, re-run the full suite and update the "Latest results" section of
`benchmarks/vanilla-extract/README.md`** (tables, run date, and the environment/version line):

```sh
pnpm --filter @benchmarks/vanilla-extract install-browser # once, for the HMR suite
pnpm benchmark:vanilla-extract
```

Run it on an idle machine on Node 24 and update all result tables — the library-build variant
matrix (baseline/minify/target/minify+target), the Vite build baseline, dev HMR, hook-filter
stress timings, and the hook-entry diagnostic (also written to
`benchmarks/vanilla-extract/results/vite-hook-counts.json`).
`pnpm --filter @benchmarks/vanilla-extract smoke` validates every build configuration first
without collecting timings. See `benchmarks/vanilla-extract/README.md` for fixture-size and
sample-count overrides.

### Testing notes

- `pnpm test` (root) runs a `pretest` hook that cleans+rebuilds `@sanity/pkg-utils` and cleans the
  `playground/*` fixtures, then runs `vitest run` — pkg-utils' own suite shells out to build/check
  ~25 `playground/*` fixtures for real, so it's a strong end-to-end signal, not just unit tests.
- `pnpm knip` produces warnings (currently 3 unused-catalog-entry warnings) but exits 0; that's
  expected/matches CI (the `knip` CI job doesn't fail the build on warnings).
- `pnpm playground:build`/`css-playground:*` build steps are memory-hungry; CI sets
  `NODE_OPTIONS=--max_old_space_size=8192` — do the same locally if you see OOM-style failures.
- The `pkg-utils init` CLI command (scaffolds a new package) uses the `prompts` package in raw TTY
  mode and is not suitable for non-interactive/non-PTY shells — it will abort rather than gracefully
  read piped stdin. It's also not covered by the automated test suite. Prefer exercising
  `pkg build`/`pkg check` directly (as the existing tests do) rather than `init` when scripting.
- `css-playground/verify` (`pnpm --filter @css-playground/verify install-browser` once, then
  `pnpm --filter @css-playground/verify verify-app <consumer> css|no-css`, e.g.
  `verify-app vite css`) is a great end-to-end smoke check: it starts a consumer's dev server,
  loads it in headless Chromium, asserts the producer's computed CSS color against the marker
  `rgb(1, 2, 3)`, and writes a screenshot to `css-playground/verify/screenshots/`. See
  `css-playground/README.md` for the full manual/automated visual-verification workflow (dev
  servers for individual consumers, e.g. `pnpm --filter @css-playground/vite dev`).
