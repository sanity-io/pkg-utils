import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  external: (prev) => prev.filter((name) => name !== '@sanity/icons'),
})
