// Copied over `panda.config.ts` by the tests whose `include` also matches the generated directory
import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  include: ['./src/**/*'],
  exclude: ['./src/ignored/**'],
  outdir: 'styled-system',
} satisfies Config)
