import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  extract: {
    checkTypes: false,
  },
  bundles: [
    {
      source: './src/browser.js',
      require: './dist/browser.cjs',
      import: './dist/browser.js',
      runtime: 'browser',
    },
  ],
})
