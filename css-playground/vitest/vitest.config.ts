import {defineConfig} from 'vitest/config'

// A local config so `vitest run` does not pick up the monorepo root config (which scopes to
// `packages/@sanity/*`).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
