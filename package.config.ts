import {defineConfig} from './src'

export default defineConfig({
  exports: (exports) => ({
    ...exports,

    '.': {
      ...exports['.'],
      runtime: 'node',
    },

    './cli': {
      ...exports['./cli'],
      runtime: 'node',
      source: './src/cli.ts',
      require: './dist/cli.cjs',
    },
  }),
})
