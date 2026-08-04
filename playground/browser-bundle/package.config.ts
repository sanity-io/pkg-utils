import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  bundles: [
    {
      source: './src/browser.js',
      require: './dist/browser.cjs',
      import: './dist/browser.js',
      runtime: 'browser',
    },
  ],
})
