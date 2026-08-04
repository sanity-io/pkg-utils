---
'@sanity/tsdown-config': minor
---

Make `defineConfig` a composable base for programmatic hosts (like the upcoming tsdown-powered `@sanity/pkg-utils`):

- New `cwd` option: forwarded to tsdown's own `cwd`, and used for the package-manager detection behind the `devExports` default instead of `process.cwd()` — so builds driven programmatically for a package in another directory resolve the right defaults.
- Package-manager detection only runs when it can affect the outcome: it exists solely to decide the pnpm-gated `devExports: true` default, so it is skipped when the userland `exports` value replaces the defaults (`false`, `true`, a bare CI condition) or sets `devExports` explicitly. Explicit configs behave identically across package managers, with no filesystem probing.
- The composition contract is now documented and covered by tests: `defineConfig()` output is a `mergeConfig`-safe base — `plugins` append (never clobbering the React Compiler / vanilla-extract plugins this config sets up), plain objects deep-merge, and scalars/non-plugin arrays replace.
- **Node 20 support is dropped**: `engines.node` is now `^22.18.0 || >=24.11.0`, matching tsdown's own requirement. The previous `>=20.19 <22` range was unachievable in practice — this package only executes inside tsdown's process, which already requires Node `^22.18.0`.
