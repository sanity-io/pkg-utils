import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sanity/pandacss-tsdown-plugin',
    environment: 'node',
    testTimeout: 30_000,
  },
})
