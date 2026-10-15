// Copied over `panda.config.ts` by the tests that change the generated class names
import {defineConfig, type Config} from '@pandacss/dev'
import {recipes} from './theme'

export default defineConfig({
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  prefix: 'x',
  theme: {recipes},
} satisfies Config)
