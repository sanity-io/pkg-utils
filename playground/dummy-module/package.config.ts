import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  legacyExports: true,
  minify: false,
  tsconfig: 'tsconfig.dist.json',
})
