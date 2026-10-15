import {playwright} from '@vitest/browser-playwright'
import {defineConfig} from 'vitest/config'
import {pandacss} from '../../../src/vite.ts'

// Run by `test/vite.test.ts`: the browser test of `src/` in headless Chromium, with the stylesheet
// generated without cascade layers
export default defineConfig({
  plugins: [pandacss({transform: true, cascadeLayers: false, banner: '@layer sui;'})],
  test: {
    include: ['src/**/*.browser-test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{browser: 'chromium'}],
    },
  },
})
