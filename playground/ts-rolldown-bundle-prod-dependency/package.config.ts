import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  extract: {bundledPackages: ['@sanity/client']},
  dts: 'rolldown',
})
