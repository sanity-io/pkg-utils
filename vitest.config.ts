import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/@sanity/*'],
    // Root `pnpm test` drives the Node matrix. Nested project configs are not always
    // applied, so Windows/macOS checkTsdoc cases flake against Vitest's 5s default.
    testTimeout: 30_000,
  },
})
