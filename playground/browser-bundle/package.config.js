'use strict'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {defineConfig} = require('@sanity/pkg-utils')

/** @type import('@sanity/pkg-utils').PkgConfigOptions */
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
