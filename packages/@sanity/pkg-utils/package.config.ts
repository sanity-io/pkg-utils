import {visualizer} from 'rollup-plugin-visualizer'
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
  extract: {
    rules: {
      'ae-incompatible-release-tags': 'error',
      'ae-internal-missing-underscore': 'off',
      'ae-missing-release-tag': 'error',
    },
  },
  rollup: {
    plugins: [
      visualizer({
        emitFile: true,
        filename: 'stats.html',
      }),
    ],
  },
  runtime: 'node',
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
})
