import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./test/env/globalSetup.ts'],

    exclude: ['**/node_modules/**', '.cache', '.git', '.idea', 'dist', 'playground'],

    // Set to 2 minutes to support long-running build tests
    testTimeout: 2 * 60 * 1000,

    // Limit workers in CI where os.cpus() over-reports available cores
    maxWorkers: process.env.CI ? 2 : undefined,
  },
  esbuild: {
    target: 'node14',
  },
  server: {
    watch: {
      // Don't rerun test watcher when generated files change, or it'll infinitely loop
      ignored: ['**/node_modules/**', '**/dist/**', '**/test/env/__tmp__/**'],
    },
  },
})
