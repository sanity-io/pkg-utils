import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  dist: 'lib',
  legacyExports: true,
  tsconfig: 'tsconfig.lib.json',
})
