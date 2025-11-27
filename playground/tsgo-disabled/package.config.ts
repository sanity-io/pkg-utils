import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  // Explicitly disable tsgo even though @typescript/native-preview is in devDependencies
  tsgo: false,
})
