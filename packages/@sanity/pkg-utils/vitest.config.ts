import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./test/env/globalSetup.ts'],

    exclude: ['**/node_modules/**', '.cache', '.git', '.idea', 'dist', 'playground'],

    // Set to 2 minutes to support long-running Next.js test
    testTimeout: 2 * 60 * 1000,

    // Reduce threads as suites will use the filesystem and `pnpm install` and need to run in sequence
    fileParallelism: false,
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
