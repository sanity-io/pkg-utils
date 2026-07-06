import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['esm', 'cjs'],
  entry: {
    index: './src/exports/index.ts',
    theme: './src/exports/theme.ts',
  },
})
