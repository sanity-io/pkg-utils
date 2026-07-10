import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  // Explicitly enable tsgo (though it would be enabled by default, as the workspace `typescript`
  // is v7, the Go-native compiler)
  tsgo: true,
})
