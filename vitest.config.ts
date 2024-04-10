import {defineConfig} from 'vitest/config'
import GithubActionsReporter from 'vitest-github-actions-reporter'

export default defineConfig({
  test: {
    globalSetup: ['./test/env/globalSetup.ts'],

    exclude: ['**/node_modules/**', '.cache', '.git', '.idea', 'dist', 'playground'],

    // Set to 2 minutes to support long-running Next.js test
    testTimeout: 2 * 60 * 1000,

    // Enable rich PR failed test annotation on the CI
    reporters: process.env.GITHUB_ACTIONS ? ['default', new GithubActionsReporter()] : 'default',

    // Reduce threads as suites will use the filesystem and `pnpm install` and need to run in sequence
    fileParallelism: false,

    // Don't rerun test watcher when generated files change, or it'll infinitely loop
    watchExclude: ['**/node_modules/**', '**/dist/**', 'test/env/__tmp__/**'],
  },
  esbuild: {
    target: 'node14',
  },
})
