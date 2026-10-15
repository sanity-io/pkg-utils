import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  platform: 'node',
  entry: {
    index: './src/index.ts',
    vite: './src/vite.ts',
  },
})
