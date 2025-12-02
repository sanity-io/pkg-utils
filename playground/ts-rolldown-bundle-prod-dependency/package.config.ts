import {defineConfig} from '@sanity/pkg-utils'

const inline = new Set(['@sanity/icons'])

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  extract: {bundledPackages: [...inline]},
  external: (prev) => prev.filter((name) => !inline.has(name)),
})
