# Vendored packages

## `vitejs-plugin-react-6.0.5-merged-f1340b0.tgz`

`@vitejs/plugin-react` built from upstream `main` at `f1340b0c` — the merge commit of
[vitejs/vite-plugin-react#1419](https://github.com/vitejs/vite-plugin-react/pull/1419), which adds
the `compiler` option (React Compiler via `oxc-transform-react`). `@sanity/tsdown-config` installs
it with a `file:` dependency for `reactCompiler: {transform: 'oxc'}`.

Not on npm yet: [vitejs/vite-plugin-react#1428](https://github.com/vitejs/vite-plugin-react/pull/1428)
releases it as `@vitejs/plugin-react@6.1.0`. The tarball still self-reports `6.0.5`.

Rebuild:

```sh
git init vpr && cd vpr
git remote add origin https://github.com/vitejs/vite-plugin-react.git
git fetch --depth 1 origin f1340b0c760b1c16e1b780eeba46fd933ddd52eb
git checkout f1340b0c760b1c16e1b780eeba46fd933ddd52eb
pnpm install --frozen-lockfile
pnpm --filter @vitejs/plugin-react build
cd packages/plugin-react && pnpm pack
```

## Removal (once `@vitejs/plugin-react@6.1.0` is on npm)

1. In `packages/@sanity/tsdown-config/package.json`, replace the `file:` dependency with `^6.1.0`.
2. Delete this directory and the `!vendor/*.tgz` exception in `.gitignore`.
3. Re-enable publint in `packages/@sanity/tsdown-config/tsdown.config.ts`.
4. Revisit the `vite:react-compiler` cherry-pick in case upstream exports the plugin directly.

Do **not** publish `@sanity/tsdown-config` while the `file:` dependency is in place — `file:`
paths do not resolve outside this repository.
