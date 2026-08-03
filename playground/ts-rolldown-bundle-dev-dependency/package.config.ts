import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  // The deprecated `external` array still works (it maps onto `deps.neverBundle` and logs a
  // deprecation warning) — this fixture deliberately keeps it to cover the grandfathered path.
  external: ['@sanity/logos'],
})
