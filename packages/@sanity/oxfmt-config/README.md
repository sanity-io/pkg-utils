# @sanity/oxfmt-config

Shared [oxfmt](https://oxc.rs/docs/guide/usage/formatter/config) config for Sanity repositories.

The preset is the formatting options that Sanity repos set to the same value: no semicolons, single quotes, and no spaces inside braces. It leaves oxfmt's own defaults alone (`printWidth` 100, `tabWidth` 2, trailing commas, and so on). Repo-specific ignores, import sorting, and Tailwind sorting stay in the repo.

## Installation

```sh
pnpm add -D @sanity/oxfmt-config oxfmt
```

## Usage

Oxfmt has no `extends` key. Spread the preset from `oxfmt.config.ts` and add local options after it:

```ts
import sanityOxfmtConfig from '@sanity/oxfmt-config'
import {defineConfig} from 'oxfmt'

export default defineConfig({
  ...sanityOxfmtConfig,
  ignorePatterns: ['dist', 'pnpm-lock.yaml'],
})
```

To format with the JSON file directly:

```sh
oxfmt -c ./node_modules/@sanity/oxfmt-config/oxfmt.json
```

`-c` disables nested config lookup, so this uses the shared file on its own. A `.oxfmtrc.json` cannot name an npm package.
