import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  babel: {reactCompiler: true},
  reactCompilerOptions: {target: '19'},
  rollup: {
    // `vanillaExtract` compat mode (default) injects the self-referential bundle.css import, emits
    // the JS shim, and writes the `./bundle.css` export to package.json automatically.
    vanillaExtract: true,
  },
})
