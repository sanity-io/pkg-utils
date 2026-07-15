import {defineConfig} from '@sanity/tsdown-config'

// The top-level `target` only names a JS runtime, which says nothing about the browsers the
// extracted CSS runs in - the plugin itself (like `@tsdown/css`) would skip CSS syntax
// lowering, so `@sanity/tsdown-config` resolves the lowering targets from
// `@sanity/browserslist-config` and passes them through `lightningcss.targets` (the tests
// assert lightningcss processes the CSS with them).
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['esm'],
  platform: 'neutral',
  target: 'node20',
  vanillaExtract: true,
})
