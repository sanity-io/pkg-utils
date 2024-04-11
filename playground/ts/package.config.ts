import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  strictOptions: {
    noImplicitSideEffects: 'error',
    noImplicitBrowsersList: 'off',
  },
})
