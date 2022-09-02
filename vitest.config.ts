import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    deps: {
      inline: ['@sanity/tsdoc'],
    },
    exclude: ['**/node_modules/**', '**/dist/**', '**/__fixtures__/**'],
    testTimeout: 60 * 1000, // 60 s
  },
  esbuild: {
    target: 'node14',
  },
})
