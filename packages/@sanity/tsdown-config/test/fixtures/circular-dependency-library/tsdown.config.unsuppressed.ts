import {defineConfig} from '@sanity/tsdown-config'
import {mergeConfig} from 'tsdown'

/**
 * The baseline the `circular-dependency` test compares against: `suppressWarnings` merged over
 * the config replaces the built-in declaration-only cycle suppression (functions don't merge),
 * so this build reports every cycle the default config filters out. It emits nothing — no
 * `write`, no `exports` generation, no `publint` — so it can't race the real build's output.
 */
export default mergeConfig(
  await defineConfig({
    tsconfig: 'tsconfig.dist.json',
    entry: {
      index: './src/exports/index.ts',
      nodes: './src/exports/nodes.ts',
    },
  }),
  {
    suppressWarnings: () => false,
    write: false,
    clean: false,
    exports: false,
    publint: false,
  },
)
