import {defineConfig} from '@sanity/pkg-utils'
import {vanillaExtractPlugin} from '@vanilla-extract/rollup-plugin'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  babel: {reactCompiler: true},
  reactCompilerOptions: {target: '19'},
  rollup: {
    output: {assetFileNames: '[name][extname]'},
    plugins: [
      vanillaExtractPlugin({
        extract: {
          name: 'style.css',
        },
      }),
    ],
  },
})
