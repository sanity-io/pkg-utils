// Copied over `panda.config.ts` by the tests that narrow the globs
import {defineConfig, type Config} from '@pandacss/dev'
import {recipes} from './theme'

export default defineConfig({
  include: ['./src/**/*.ts'],
  exclude: ['./src/index.ts'],
  outdir: 'styled-system',
  theme: {recipes},
} satisfies Config)
