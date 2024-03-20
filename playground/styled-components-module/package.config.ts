import swc from '@rollup/plugin-swc'
import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  extract: {
    rules: {
      'ae-forgotten-export': 'off',
    },
  },
  tsconfig: 'tsconfig.dist.json',
  rollup: {
    plugins: [swc()],
  },
  babel: {
    // plugins: ['babel-plugin-styled-components'],
  },
})
