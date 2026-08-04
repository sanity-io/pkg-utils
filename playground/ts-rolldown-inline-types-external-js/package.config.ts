import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  // Force-bundle `@sanity/icons` (JS and types) while `@sanity/client` and `@sanity/logos`
  // stay fully external. Inlining only the *types* of an external dependency (the v11
  // `extract.bundledPackages` pattern this fixture used to exercise) has no successor: type
  // inlining follows the bundling decisions.
  deps: {alwaysBundle: [/^@sanity\/icons(\/|$)/]},
})
