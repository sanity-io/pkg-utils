import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  reactCompiler: {target: '19'},
  // `vanillaExtract` injects the self-referential bundle.css import, emits the JS shim, and
  // writes the `./bundle.css` export to package.json automatically.
  vanillaExtract: true,
})
