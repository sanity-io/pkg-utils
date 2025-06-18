import {defineConfig} from '@sanity/pkg-utils'
import baseConfig from './repo.package.config'

export default defineConfig({...baseConfig, external: ['sanity']})
