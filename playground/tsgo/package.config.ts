import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  // Explicitly enable tsgo (though it would be enabled by default due to @typescript/native-preview)
  tsgo: true,
})
