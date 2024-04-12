import {defineConfig} from '@sanity/pkg-utils'

import baseConfig from './repo.package.config'

export default defineConfig({
  ...baseConfig,

  extract: {
    ...baseConfig.extract,
    rules: {
      ...baseConfig.extract.rules,
      'ae-incompatible-release-tags': 'error',
      'ae-missing-release-tag': 'error',
    },
  },
})
