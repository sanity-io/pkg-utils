import {defineConfig} from './src/node'

export default defineConfig({
  strictOptions: {
    noPublishConfigExports: 'error',
  },
  bundles: [
    {
      source: './src/cli/index.ts',
      import: './dist/cli.js',
    },
  ],
  tsdoc: {
    rules: {
      'ae-incompatible-release-tags': 'error',
      'ae-internal-missing-underscore': 'off',
      'ae-missing-release-tag': 'error',
    },
  },
  runtime: 'node',
  tsconfig: 'tsconfig.dist.json',
})
