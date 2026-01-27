import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '.cache', '.git', '.idea', 'dist', 'playground'],
    // Set to 2 minutes to support long-running tests
    testTimeout: 2 * 60 * 1000,
  },
  server: {
    watch: {
      // Don't rerun test watcher when generated files change, or it'll infinitely loop
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
})
