import {reactCompilerSurfacesPlugin} from '@sanity/react-compiler-rolldown-plugin'
import {defineConfig} from '@sanity/tsdown-config'
import {mergeConfig} from 'tsdown'

// The surfaces plugin only annotates, so it composes from the outside — the one rule is that
// it must run before the React Compiler babel pass, which `mergeConfig` guarantees by
// prepending it to the `plugins` array
export default mergeConfig(
  {plugins: [reactCompilerSurfacesPlugin()]},
  await defineConfig({
    tsconfig: 'tsconfig.dist.json',
    format: ['esm', 'cjs'],
    platform: 'neutral',
    reactCompiler: {target: '19'},
    define: {'process.env.NODE_ENV': JSON.stringify('production')},
  }),
)
