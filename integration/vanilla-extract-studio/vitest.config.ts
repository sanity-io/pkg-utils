import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Every test spawns full `sanity` CLI commands against the same studio directory
    // (shared `.sanity` runtime and Vite caches), so they must run one at a time.
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 600_000,
    hookTimeout: 120_000,
  },
})
