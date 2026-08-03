import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  // This package fails the TSDoc check
  tsdoc: false,
})
