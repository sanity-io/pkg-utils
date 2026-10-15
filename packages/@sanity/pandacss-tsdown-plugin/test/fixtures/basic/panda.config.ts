import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  preflight: false,
  theme: {
    recipes: {
      badge: {className: 'badge', base: {fontWeight: 'bold'}},
    },
  },
} satisfies Config)
