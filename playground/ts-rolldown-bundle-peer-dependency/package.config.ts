import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  dts: 'rolldown',
  external: (prev) => prev.filter((name) => name !== '@sanity/icons'),
  // This fixture deliberately bundles `@sanity/client` from `peerDependencies` to
  // exercise the peer-dependency bundling path, so the strict placement check is disabled.
  strictOptions: {
    noSanityClientPeerDependency: 'off',
  },
})
