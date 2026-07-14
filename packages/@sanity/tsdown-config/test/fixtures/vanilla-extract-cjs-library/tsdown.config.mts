import {defineConfig} from '@sanity/tsdown-config'

// A `"type": "commonjs"` package: the `.js` files in `dist` are CommonJS, so the no-op shim of
// the conditional `./bundle.css` export must not assume ESM - the runtime tests `require()` and
// `import()` the built output in a real Node process to catch that.
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['cjs', 'esm'],
  platform: 'neutral',
  vanillaExtract: true,
})
