import {defineConfig} from './src'

export default defineConfig({
  exports: (exports) => ({
    ...exports,

    './cli': {
      ...exports['./cli'],
      source: './src/cli.ts',
      require: './dist/cli.cjs',
    },
  }),

  runtime: 'node',
})
