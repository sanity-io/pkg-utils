import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  // The deprecated `external` callback still works (entries filtered out of the defaults map
  // onto `deps.alwaysBundle`, with a deprecation warning) — this fixture deliberately keeps it
  // to cover the grandfathered path.
  external: (prev) => prev.filter((name) => name !== '@sanity/icons'),
  // This fixture deliberately bundles `@sanity/icons` from `peerDependencies` to exercise the
  // peer-dependency bundling path, so the strict placement checks are disabled.
  strictOptions: {
    noSanityClientPeerDependency: 'off',
    noSanityIconsPeerDependency: 'off',
  },
})
