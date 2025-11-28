import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  extract: {
    // This package fails to build with extract enabled
    enabled: false,
  },
})
