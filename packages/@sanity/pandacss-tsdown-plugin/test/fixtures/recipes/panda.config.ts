import {defineConfig, type Config} from '@pandacss/dev'

// The `basic` config plus a pattern and a config recipe: the modules of this fixture use only
// those (or `token()`), never `css()` itself.
export default defineConfig({
  presets: [],
  preflight: false,
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  outExtension: 'js',
  importMap: '#styled-system',
  theme: {
    tokens: {
      colors: {brand: {value: '#f03e2f'}},
    },
    recipes: {
      button: {
        className: 'button',
        base: {display: 'inline-flex'},
        variants: {tone: {brand: {color: 'brand'}}},
      },
    },
  },
  patterns: {
    row: {
      properties: {gap: {type: 'number'}},
      // Annotated, since the inferred `props` type is internal to `@pandacss/types`
      transform: (props: {gap?: number}) => ({display: 'flex', ...props}),
    },
  },
  utilities: {
    color: {values: 'colors'},
    display: {},
    gap: {},
  },
} satisfies Config)
