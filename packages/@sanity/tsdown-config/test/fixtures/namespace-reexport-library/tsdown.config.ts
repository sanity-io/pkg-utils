import {defineConfig} from '@sanity/tsdown-config'

// The `tsdoc` check runs as part of the build: if `ae-missing-release-tag` regressed to flag
// the synthesized namespace wrappers again (https://github.com/sanity-io/pkg-utils/issues/3281),
// this fixture build — and with it the test run — fails.
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['esm', 'cjs'],
  entry: {
    index: './src/index.ts',
    extra: './src/extra.ts',
  },
  tsdoc: {rules: {'ae-missing-release-tag': 'error'}},
})
