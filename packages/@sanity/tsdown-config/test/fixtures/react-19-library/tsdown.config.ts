import {defineConfig} from '@sanity/tsdown-config'

// @TODO add support for passing `define` options to `@sanity/tsdown-config`
export default {
  ...defineConfig({
    tsconfig: 'tsconfig.dist.json',
    format: ['esm', 'cjs'],
    platform: 'neutral',
    reactCompiler: {target: '19'},
  }),
  define: {'process.env.NODE_ENV': JSON.stringify('production')},
} as any
