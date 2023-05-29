import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  babel: {
    plugins: ['@babel/plugin-proposal-object-rest-spread'],
  },
  tsconfig: 'tsconfig.dist.json',
})
