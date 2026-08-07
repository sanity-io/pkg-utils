import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  entry: {
    index: './src/exports/index.ts',
    nodes: './src/exports/nodes.ts',
  },
})
