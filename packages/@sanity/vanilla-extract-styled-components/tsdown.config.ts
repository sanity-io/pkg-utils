import {defineConfig} from '@sanity/tsdown-config'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  // A runtime that ships to browsers (and SSR), unlike the Node-only build tooling next to it
  target: 'baseline-widely-available',
})
