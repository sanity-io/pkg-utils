import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  babel: {reactCompiler: true},
  reactCompilerOptions: {target: '19'},
  rollup: {
    output: {
      intro: (chunkInfo) => {
        if (!chunkInfo.isEntry) {
          return ''
        }
        return `import './bundle.css'`
      },
    },
    vanillaExtract: true,
  },
})
