import path from 'node:path'
import {defineConfig} from 'vite'

function requiredEnvironmentPath(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return path.resolve(value)
}

const fixtureRoot = requiredEnvironmentPath('VE_BENCH_FIXTURE_ROOT')
const outputDirectory = requiredEnvironmentPath('VE_BENCH_OUTPUT_DIR')
const plugin = process.env['VE_BENCH_PLUGIN']
const identifiers = process.env['VE_BENCH_IDENTIFIERS'] === 'debug' ? 'debug' : 'short'

if (plugin !== 'official' && plugin !== 'sanity') {
  throw new Error(`VE_BENCH_PLUGIN must be "official" or "sanity", received ${plugin}`)
}

// Lazy-loaded so this process only ever evaluates the plugin under test.
const {vanillaExtractPlugin} =
  plugin === 'official'
    ? await import('@vanilla-extract/vite-plugin')
    : await import('../.generated/plugins/vite-plugin.mjs')

// Minify and target are intentionally not varied here: Vite handles both itself, identically
// for either plugin, so they'd only add identical work to both sides of the comparison.
export default defineConfig({
  root: fixtureRoot,
  cacheDir: path.join(outputDirectory, '.vite-cache'),
  clearScreen: false,
  logLevel: process.env['VE_BENCH_LOG_LEVEL'] === 'warn' ? 'warn' : 'silent',
  plugins: [vanillaExtractPlugin({identifiers})],
  build: {
    copyPublicDir: false,
    // `esnext` disables Vite's default downleveling so the comparison is transform-free
    cssMinify: false,
    cssTarget: 'esnext',
    emptyOutDir: false,
    minify: false,
    outDir: outputDirectory,
    reportCompressedSize: false,
    rolldownOptions: {
      checks: {
        pluginTimings: true,
      },
    },
    sourcemap: false,
    target: 'esnext',
  },
})
