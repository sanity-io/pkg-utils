import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  // Force-bundle `@sanity/icons` (subpaths included) even though it's a prod dependency; its
  // types are inlined into the emitted declarations too, as type inlining follows the
  // bundling decisions. `deps` follows tsdown's matching semantics: strings match exactly (or
  // as globs), so subpath imports need a pattern.
  deps: {alwaysBundle: [/^@sanity\/icons(\/|$)/]},
})
