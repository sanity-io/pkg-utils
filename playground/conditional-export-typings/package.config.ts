import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  bundles: [
    {
      source: './src/index.ts',
      require: './dist/index.node.cjs',
      import: './dist/index.node.js',
      runtime: 'node',
    },
    {
      source: './src/middleware/index.ts',
      require: './dist/middleware/index.node.cjs',
      import: './dist/middleware/index.node.js',
      runtime: 'node',
    },
  ],
})
