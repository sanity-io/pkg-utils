import {defineConfig} from '@sanity/tsdown-config'

// Opt into both pipelines at once: vanilla-extract extracts `.css.ts` into `bundle.css`
// (with the conditional CSS export), while `@tsdown/css` handles `.module.css` (merged into
// `style.css` by default). The two file names keep the outputs from colliding.
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['esm'],
  platform: 'neutral',
  target: 'chrome61',
  vanillaExtract: true,
  css: {
    inject: true,
    modules: {localsConvention: 'camelCase'},
  },
})
