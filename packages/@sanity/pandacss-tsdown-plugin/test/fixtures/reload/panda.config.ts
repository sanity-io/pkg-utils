import {defineConfig, type Config} from '@pandacss/dev'
import {recipes} from './theme'

export default defineConfig({
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  theme: {recipes},
} satisfies Config)
