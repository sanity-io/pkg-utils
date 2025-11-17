import {visualizer} from 'rollup-plugin-visualizer'
import {defineConfig} from './src/node'

export default defineConfig({
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
  strictOptions: {
    // Keep the main field for backward compatibility with older tooling
    noPackageJsonMain: 'off',
  },
})
