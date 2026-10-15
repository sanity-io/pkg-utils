import {defineConfig, type Config} from '@pandacss/dev'

// A preset-free config with React JSX: the `box` pattern generates the `<Box>` component, whose
// style props (`color="brand"`) Panda extracts from the JSX.
export default defineConfig({
  presets: [],
  preflight: false,
  include: ['./src/**/*.{ts,tsx}'],
  outdir: 'styled-system',
  outExtension: 'js',
  importMap: '#styled-system',
  jsxFramework: 'react',
  theme: {
    tokens: {
      colors: {brand: {value: '#f03e2f'}},
    },
  },
  patterns: {
    box: {
      properties: {},
      // Annotated, since the inferred `props` type is internal to `@pandacss/types`
      transform: (props: Record<string, unknown>) => props,
    },
  },
  utilities: {
    color: {values: 'colors'},
  },
} satisfies Config)
