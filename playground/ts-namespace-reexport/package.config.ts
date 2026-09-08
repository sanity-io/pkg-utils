import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  tsdoc: {rules: {'ae-missing-release-tag': 'error'}},
  strictOptions: {
    noImplicitBrowsersList: 'off',
  },
})
