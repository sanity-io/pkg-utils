import {defineConfig} from 'vitest/config'
import GithubActionsReporter from 'vitest-github-actions-reporter'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '.cache', '.git', '.idea', 'dist', 'playground'],

    // Set to 2 minutes to support long-running Next.js test
    testTimeout: 2 * 60 * 1000,

    // Enable rich PR failed test annotation on the CI
    reporters: process.env.GITHUB_ACTIONS ? ['default', new GithubActionsReporter()] : 'default',
  },
  esbuild: {
    target: 'node14',
  },
})
