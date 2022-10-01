import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    deps: {
      inline: ['@sanity/tsdoc'],
    },
    exclude: ['**/node_modules/**', '.cache', '.git', '.idea', 'dist', 'playground'],

    // Set to 2 minutes to support long-running Next.js test
    testTimeout: 2 * 60 * 1000,
  },
  esbuild: {
    target: 'node14',
  },
})
