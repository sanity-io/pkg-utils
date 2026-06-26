import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  external: (prev) => prev.filter((name) => name !== '@sanity/icons'),
  // This fixture deliberately bundles `@sanity/client` and `@sanity/icons` from
  // `peerDependencies` to exercise the peer-dependency bundling path, so the strict
  // placement checks are disabled.
  strictOptions: {
    noSanityClientPeerDependency: 'off',
    noSanityIconsPeerDependency: 'off',
  },
})
