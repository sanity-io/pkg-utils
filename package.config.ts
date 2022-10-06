import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  bundles: [
    {
      source: './src/cli/index.ts',
      require: './dist/cli.js',
    },
  ],
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
