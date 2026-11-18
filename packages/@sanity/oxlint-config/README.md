# @sanity/oxlint-config

Shared [oxlint](https://oxc.rs/docs/guide/usage/linter/config) config for Sanity repositories.

Oxlint enables the `correctness` category as warnings. Sanity repos that set the category set it to `error`. This preset does that, and nothing else: plugins, individual rules, `suspicious` / `perf`, and type-aware checking are not the same across repos, so they stay local.

## Installation

```sh
pnpm add -D @sanity/oxlint-config oxlint
```

## Usage

`oxlint.config.ts` can import the preset. `extends` merges `categories`, `rules`, `plugins`, `overrides`, and `options`. It does not merge `env`, `settings`, or `ignorePatterns` (checked with oxlint 1.94).

```ts
import sanityOxlintConfig from '@sanity/oxlint-config'
import {defineConfig} from 'oxlint'

export default defineConfig({
  extends: [sanityOxlintConfig],
  // Local rules and plugins are merged on top.
})
```

`.oxlintrc.json` only extends file paths, not package names:

```json
{
  "extends": ["./node_modules/@sanity/oxlint-config/oxlintrc.json"]
}
```

This preset does not set `plugins`. An extending config that omits `plugins` keeps oxlint's defaults (`unicorn`, `typescript`, `oxc`). An extending config that sets `plugins` adds that list to those defaults. Defaults drop out only when some config in the `extends` chain sets `plugins` and the extending config sets `plugins` too.
