import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  babel: {reactCompiler: true},
  reactCompilerOptions: {target: '19'},
})
