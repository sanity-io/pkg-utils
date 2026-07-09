import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  // Explicitly enable tsgo (though it's always used for `dts: 'rolldown'`, as `@sanity/pkg-utils`
  // ships the Go-native TypeScript compiler)
  tsgo: true,
})
