import {defineConfig} from '@sanity/pkg-utils'
import postcss from 'rollup-plugin-postcss'

export default defineConfig({
  minify: false,
  rollup: {
    plugins: [
      postcss({
        extract: true,
        minimize: false,
        sourceMap: true,
      }),
    ],
  },
  tsconfig: 'tsconfig.dist.json',
})
