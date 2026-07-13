import {defineConfig} from '@sanity/tsdown-config'

// `vanillaExtract` with `inject` (the default) injects the self-referential bundle.css import,
// emits the JS shim, and writes the conditional `./bundle.css` export to package.json
// automatically. The top-level `target` doubles as the CSS syntax lowering target (the tests
// assert that `inset` is flattened for chrome61).
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['esm', 'cjs'],
  platform: 'neutral',
  target: 'chrome61',
  vanillaExtract: true,
})
