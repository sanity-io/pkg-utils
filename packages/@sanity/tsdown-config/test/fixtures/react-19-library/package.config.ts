import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  tsdoc: false,
  reactCompiler: {target: '19'},
})
