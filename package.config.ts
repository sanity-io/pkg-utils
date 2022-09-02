import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  exports: (exports) => ({
    ...exports,
    './cli': {
      source: './src/cli/index.ts',
      require: './dist/cli.cjs',
    },
  }),
  external: (external) => external.concat(['@sanity/tsdoc']),
  extract: {
    rules: {
      'ae-forgotten-export': 'error',
      'ae-incompatible-release-tags': 'error',
      'ae-internal-missing-underscore': 'error',
      'ae-missing-release-tag': 'error',
    },
  },
  minify: false,
  runtime: 'node',
})
