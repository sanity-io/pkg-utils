import {vanillaExtractPlugin as sanityVanillaExtractPlugin} from '@sanity/vanilla-extract-vite-plugin'
import {vanillaExtractPlugin as officialVanillaExtractPlugin} from '@vanilla-extract/vite-plugin'
import {defineCliConfig} from 'sanity/cli'

const pluginKind = process.env['VE_STUDIO_PLUGIN']
if (pluginKind !== 'official' && pluginKind !== 'sanity') {
  throw new Error('VE_STUDIO_PLUGIN must be "official" or "sanity"')
}

const identifierMode = process.env['VE_STUDIO_IDENTIFIERS']
if (identifierMode !== 'short' && identifierMode !== 'debug' && identifierMode !== 'custom') {
  throw new Error('VE_STUDIO_IDENTIFIERS must be "short", "debug", or "custom"')
}

const identifiers =
  identifierMode === 'custom' ? ({hash}: {hash: string}) => `parity_${hash}` : identifierMode
const vanillaExtractPlugin =
  pluginKind === 'official' ? officialVanillaExtractPlugin : sanityVanillaExtractPlugin

export default defineCliConfig({
  api: {projectId: 'ppsg7ml5', dataset: 'test'},
  vite: {
    cacheDir: process.env['VE_STUDIO_CACHE_DIR'],
    plugins: [vanillaExtractPlugin({identifiers})],
    // Sanity's schema extraction config forces SSR dependencies inline. Keeping that constraint
    // explicit here ensures both plugins remain safe when their compiler evaluates CommonJS
    // transitive dependencies such as picocolors.
    ssr: {noExternal: true},
    // Production Studio builds include the browser condition. The compiler still evaluates
    // styles in Node and must match the official plugin without mutating the parent conditions.
    resolve: {conditions: ['browser', 'module', 'import', 'default']},
    build: {
      cssMinify: process.env['VE_STUDIO_CSS_MINIFY'] === '1',
      cssTarget: process.env['VE_STUDIO_CSS_TARGET'] || 'esnext',
      minify: false,
      sourcemap: false,
    },
  },
})
