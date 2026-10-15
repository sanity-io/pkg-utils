import {defineConfig} from '@sanity/tsdown-config'

// `transform: false` opts out of the default rewrite: the `css()` calls stay and run through
// Panda's runtime, while the stylesheet is still extracted and wired up.
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['esm', 'cjs'],
  platform: 'neutral',
  target: 'chrome61',
  panda: {transform: false},
})
