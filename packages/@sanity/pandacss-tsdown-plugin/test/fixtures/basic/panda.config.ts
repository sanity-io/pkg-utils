import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  preflight: false,
  patterns: {
    row: {
      properties: {gap: {type: 'property', value: 'gap'}},
      // Annotated, since the inferred `props` type is internal to `@pandacss/types`
      transform: (props: {gap?: string}) => ({display: 'flex', ...props}),
    },
  },
  theme: {
    recipes: {
      badge: {className: 'badge', base: {fontWeight: 'bold'}},
    },
  },
} satisfies Config)
