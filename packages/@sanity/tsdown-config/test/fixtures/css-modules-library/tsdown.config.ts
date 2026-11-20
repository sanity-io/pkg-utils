import {defineConfig} from '@sanity/tsdown-config'

// `@tsdown/css` handles `.module.css` (merged into `style.css` by default), with the
// conditional CSS export.
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['esm'],
  platform: 'neutral',
  target: 'chrome61',
  css: {
    inject: true,
    modules: {localsConvention: 'camelCase'},
  },
})
