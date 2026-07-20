/**
 * The CLI config of the fixture studio. The vanilla-extract plugin implementation and its
 * options are selected through `VE_*` environment variables so the integration tests can run
 * the same studio through `sanity dev` / `sanity build` / `sanity schema extract` with the
 * fork (`@sanity/vanilla-extract-vite-plugin`) and with the upstream reference
 * (`@vanilla-extract/vite-plugin`) across the option matrix. See `test/variants.ts`.
 */
import {vanillaExtractPlugin as forkVanillaExtractPlugin} from '@sanity/vanilla-extract-vite-plugin'
import {vanillaExtractPlugin as upstreamVanillaExtractPlugin} from '@vanilla-extract/vite-plugin'
import {defineCliConfig} from 'sanity/cli'
import type {BuildOptions, PluginOption} from 'vite'

type IdentifierOption = Parameters<typeof forkVanillaExtractPlugin>[0] extends
  {identifiers?: infer T} | undefined
  ? T
  : never

/**
 * The custom identifier function of the `prefix` variant, shared verbatim between both
 * implementations: derived class names must come out identical.
 */
const prefixIdentifiers: IdentifierOption = ({hash, debugId}) =>
  debugId ? `ve_${debugId}_${hash}` : `ve_${hash}`

function resolveIdentifiers(): IdentifierOption | undefined {
  const identifiers = process.env['VE_IDENTIFIERS']
  if (!identifiers) return undefined
  if (identifiers === 'prefix') return prefixIdentifiers
  if (identifiers === 'short' || identifiers === 'debug') return identifiers
  throw new Error(`Unsupported VE_IDENTIFIERS value: ${identifiers}`)
}

function resolvePlugin(): PluginOption {
  const implementation = process.env['VE_PLUGIN'] ?? 'fork'
  const identifiers = resolveIdentifiers()
  const options = identifiers === undefined ? {} : {identifiers}
  if (implementation === 'fork') return forkVanillaExtractPlugin(options)
  if (implementation === 'upstream') return upstreamVanillaExtractPlugin(options)
  throw new Error(`Unsupported VE_PLUGIN value: ${implementation}`)
}

function resolveCssBuildOptions(): Pick<BuildOptions, 'cssMinify' | 'cssTarget'> {
  const build: Pick<BuildOptions, 'cssMinify' | 'cssTarget'> = {}
  const cssMinify = process.env['VE_CSS_MINIFY']
  if (cssMinify === 'true') build.cssMinify = true
  else if (cssMinify === 'false') build.cssMinify = false
  else if (cssMinify === 'lightningcss') build.cssMinify = 'lightningcss'
  else if (cssMinify) throw new Error(`Unsupported VE_CSS_MINIFY value: ${cssMinify}`)
  const cssTarget = process.env['VE_CSS_TARGET']
  if (cssTarget) build.cssTarget = cssTarget
  return build
}

export default defineCliConfig({
  api: {
    projectId: process.env['SANITY_STUDIO_PROJECT_ID'] || 'ppsg7ml5',
    dataset: process.env['SANITY_STUDIO_DATASET'] || 'test',
  },
  // Vite's experimental bundled dev mode (`sanity dev` serves a Rolldown-bundled module graph
  // with on-demand chunk compilation instead of unbundled per-module ESM). Node_modules files
  // go through the plugin pipeline in this mode — including `plain-css-js-dependency`'s
  // fake `Styles.css.js` — instead of being pre-bundled away by the dep optimizer.
  unstable_bundledDev: process.env['VE_BUNDLED_DEV'] === 'true',
  vite: {
    plugins: [resolvePlugin()],
    build: resolveCssBuildOptions(),
  },
})
