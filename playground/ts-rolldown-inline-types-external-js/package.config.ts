import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  external: (prev) => prev.filter((name) => name !== '@sanity/icons'),
  extract: {bundledPackages: ['@sanity/client', '@sanity/icons']},
})
