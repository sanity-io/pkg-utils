import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    deps: {
      inline: ['@sanity/tsdoc-to-portable-text'],
    },
    exclude: ['**/node_modules/**', '**/dist/**', '**/__fixtures__/**'],
    testTimeout: 20000,
  },
  esbuild: {
    target: 'node14',
  },
})
