import {defineConfig} from '@sanity/pkg-utils'

// Opt out of auto-written `sideEffects`: this package's entries exist to run an external
// side-effect import, so the allowlist in package.json is intentional and hand-maintained.
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  sideEffects: false,
})
