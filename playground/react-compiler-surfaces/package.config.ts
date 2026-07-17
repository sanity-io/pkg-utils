import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  babel: {reactCompiler: true, reactCompilerSurfaces: true},
  reactCompilerOptions: {target: '19'},
  extract: {
    rules: {
      // `@portabletext/react` documents its generics with `@template`, which the default
      // TSDoc configuration doesn't define
      'tsdoc-undefined-tag': 'off',
    },
  },
})
