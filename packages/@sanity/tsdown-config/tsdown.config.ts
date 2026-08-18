import {mergeConfig} from 'tsdown'
import {defineConfig} from './src/index.ts'

export default mergeConfig(
  await defineConfig({
    tsconfig: 'tsconfig.dist.json',
    platform: 'node',
    entry: {
      index: './src/index.ts',
      tsdoc: './src/tsdoc/index.ts',
    },
  }),
  {
    // The vendored `file:` tarball of `@vitejs/plugin-react` (see vendor/README.md) trips
    // publint's local-dependency check by design: this package must not be published while
    // the tarball is in place. Re-enable publint when the npm release replaces the tarball.
    publint: false,
  },
)
