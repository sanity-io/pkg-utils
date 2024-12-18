import {defineConfig} from '@sanity/pkg-utils'

module.exports = defineConfig({
  bundles: [
    {
      source: './src/browser.js',
      require: './dist/browser.cjs',
      import: './dist/browser.js',
      runtime: 'browser',
    },
  ],
})
