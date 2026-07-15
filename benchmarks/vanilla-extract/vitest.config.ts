import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
    fileParallelism: false,
    include: ['test/**/*.test.ts'],
    maxWorkers: 1,
    testTimeout: 120_000,
  },
})
