import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
  importMap: '#styled-system',
  preflight: false,
  theme: {
    extend: {
      tokens: {
        colors: {
          brand: {value: 'rgb(1, 2, 3)'},
        },
        spacing: {
          sm: {value: '8px'},
        },
      },
    },
  },
} satisfies Config)
