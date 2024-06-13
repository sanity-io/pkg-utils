import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  babel: {
    plugins: ['@babel/plugin-transform-object-rest-spread'],
  },
  tsconfig: 'tsconfig.dist.json',
})
