import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  bundles: [
    {
      source: './src/index.ts',
      require: './dist/index.browser.cjs',
      import: './dist/index.browser.js',
      runtime: 'browser',
    },
    {
      source: './src/index.ts',
      require: './dist/index.node.cjs',
      import: './dist/index.node.js',
      runtime: 'node',
    },
  ],
})
