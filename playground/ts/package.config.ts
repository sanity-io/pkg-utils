import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  extract: {
    checkTypes: false,
  },
  strictOptions: {
    noImplicitSideEffects: 'error',
    noImplicitBrowsersList: 'off',
  },
})
