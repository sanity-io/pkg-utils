import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    // checkTsdoc/api-extractor cases regularly take 4–6s on Windows/macOS CI
    testTimeout: 30_000,
  },
})
