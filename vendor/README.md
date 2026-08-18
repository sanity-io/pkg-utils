# Vendored packages

## `vitejs-plugin-react-6.0.5-pr1419-cb1fd1c.tgz`

A build of `@vitejs/plugin-react` from the unreleased
[vitejs/vite-plugin-react#1419](https://github.com/vitejs/vite-plugin-react/pull/1419)
("feat(react): add native React Compiler support"), which adds the `compiler` option backed by
[`oxc-transform-react`](https://www.npmjs.com/package/oxc-transform-react) — the Rust port of the
React Compiler. `@sanity/tsdown-config` consumes it (via a `file:` dependency) for the
`reactCompiler: {implementation: 'oxc'}` option, alongside the unchanged `reactCompilerPreset`
babel path.

The PR's pkg.pr.new "preview" CI job skips fork PRs, so no hosted build exists — this tarball is
built from the PR head instead:

- Repository: `vitejs/vite-plugin-react`, PR head `cb1fd1ca656653895acdc92efebf37a774e7ab25`
  (branch `Boshen:agent/react-compiler`)
- The tarball self-reports version `6.0.5` (the PR does not bump the version), so the filename and
  this file carry the provenance.

Rebuild recipe:

```sh
git init vpr && cd vpr
git remote add origin https://github.com/vitejs/vite-plugin-react.git
git fetch --depth 1 origin pull/1419/head
git checkout cb1fd1ca656653895acdc92efebf37a774e7ab25
pnpm install --frozen-lockfile
pnpm --filter @vitejs/plugin-react build
cd packages/plugin-react && pnpm pack
```

## Removal plan

Once an `@vitejs/plugin-react` release containing #1419 is published to npm:

1. Replace the `file:` dependency in `packages/@sanity/pkg-utils/../tsdown-config/package.json`
   with the published semver range.
2. Delete this directory.
3. Revisit the `vite:react-compiler` plugin cherry-pick in `@sanity/tsdown-config` in case
   upstream starts exporting the compiler plugin directly.

Do **not** publish `@sanity/tsdown-config` to npm while the `file:` dependency is in place —
`file:` paths do not resolve outside this repository.
