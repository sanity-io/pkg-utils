import {defineConfig} from '@sanity/tsdown-config'

// The top-level `target` only names a JS runtime, which says nothing about the browsers the
// extracted CSS runs in - the CSS syntax lowering targets fall back to
// `@sanity/browserslist-config` (the tests assert lightningcss processes the CSS with them).
// `minify` is disabled so that processing is only attributable to the fallback targets.
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['esm'],
  platform: 'neutral',
  target: 'node20',
  vanillaExtract: {minify: false},
})
