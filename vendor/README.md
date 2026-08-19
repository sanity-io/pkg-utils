# Vendored packages

## `vitejs-plugin-react-6.0.5-merged-f1340b0.tgz`

A build of `@vitejs/plugin-react` from vite-plugin-react `main` at
`f1340b0c760b1c16e1b780eeba46fd933ddd52eb` — the merge commit of
[vitejs/vite-plugin-react#1419](https://github.com/vitejs/vite-plugin-react/pull/1419)
("feat(react): add native React Compiler support"), which adds the `compiler` option backed by
[`oxc-transform-react`](https://www.npmjs.com/package/oxc-transform-react) — the Rust port of the
React Compiler. `@sanity/tsdown-config` consumes it (via a `file:` dependency) for the
`reactCompiler: {transform: 'oxc'}` option, alongside the unchanged `reactCompilerPreset`
babel path.

The feature is merged upstream but not yet published: the release PR
[vitejs/vite-plugin-react#1428](https://github.com/vitejs/vite-plugin-react/pull/1428) will ship
it as `@vitejs/plugin-react@6.1.0`. Until then this tarball fills in (the tarball self-reports
the pre-release version `6.0.5`, so the filename and this file carry the provenance).

Rebuild recipe:

```sh
git init vpr && cd vpr
git remote add origin https://github.com/vitejs/vite-plugin-react.git
git fetch --depth 1 origin f1340b0c760b1c16e1b780eeba46fd933ddd52eb
git checkout f1340b0c760b1c16e1b780eeba46fd933ddd52eb
pnpm install --frozen-lockfile
pnpm --filter @vitejs/plugin-react build
cd packages/plugin-react && pnpm pack
```

## Removal plan

Once `@vitejs/plugin-react@6.1.0` (or later) is published to npm:

1. Replace the `file:` dependency in `packages/@sanity/tsdown-config/package.json`
   with the published semver range (`^6.1.0`).
2. Delete this directory (and the `!vendor/*.tgz` exception in `.gitignore`).
3. Re-enable publint in `packages/@sanity/tsdown-config/tsdown.config.ts`.
4. Revisit the `vite:react-compiler` plugin cherry-pick in `@sanity/tsdown-config` in case
   upstream starts exporting the compiler plugin directly.

Do **not** publish `@sanity/tsdown-config` to npm while the `file:` dependency is in place —
`file:` paths do not resolve outside this repository.
