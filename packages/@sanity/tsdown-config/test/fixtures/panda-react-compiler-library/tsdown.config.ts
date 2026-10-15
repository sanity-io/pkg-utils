import {defineConfig} from '@sanity/tsdown-config'

// `panda` together with the React Compiler, whose default `oxc` implementation lowers JSX in the
// same pass: Panda has to see the JSX first, or `<Box color="brand">` extracts nothing.
export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  format: ['esm', 'cjs'],
  platform: 'neutral',
  reactCompiler: {target: '19'},
  panda: true,
})
