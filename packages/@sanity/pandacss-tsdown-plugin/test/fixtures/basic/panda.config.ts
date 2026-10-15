import {defineConfig, type Config} from '@pandacss/dev'

// A minimal, preset-free config (like a design system that ejects Panda's presets): the
// `color` utility resolves the `colors` tokens, the others take raw values.
export default defineConfig({
  presets: [],
  preflight: false,
  include: ['./src/**/*.ts'],
  exclude: ['./src/**/*.test.ts'],
  outdir: 'styled-system',
  outExtension: 'js',
  importMap: '#styled-system',
  theme: {
    tokens: {
      colors: {brand: {value: '#f03e2f'}},
    },
  },
  utilities: {
    color: {values: 'colors'},
    display: {},
    inset: {},
  },
} satisfies Config)
