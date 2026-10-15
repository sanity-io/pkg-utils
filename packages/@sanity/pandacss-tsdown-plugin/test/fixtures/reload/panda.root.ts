// Copied over `panda.config.ts` by the tests that make the project root an `include` base,
// which also holds the build output and the generated directory
import {defineConfig, type Config} from '@pandacss/dev'
import {recipes} from './theme'

export default defineConfig({
  include: ['./**/*.ts'],
  outdir: 'styled-system',
  theme: {recipes},
} satisfies Config)
