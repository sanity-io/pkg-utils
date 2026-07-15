import path from 'node:path'
import {vanillaExtractPlugin as officialVanillaExtractPlugin} from '@vanilla-extract/vite-plugin'
import {defineConfig} from 'vite'
import {vanillaExtractPlugin as sanityVanillaExtractPlugin} from '../.generated/plugins/vite-plugin.mjs'

function requiredEnvironmentPath(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return path.resolve(value)
}

const fixtureRoot = requiredEnvironmentPath('VE_BENCH_FIXTURE_ROOT')
const outputDirectory = requiredEnvironmentPath('VE_BENCH_OUTPUT_DIR')
const plugin = process.env['VE_BENCH_PLUGIN']

if (plugin !== 'official' && plugin !== 'sanity') {
  throw new Error(`VE_BENCH_PLUGIN must be "official" or "sanity", received ${plugin}`)
}

export default defineConfig({
  root: fixtureRoot,
  cacheDir: path.join(outputDirectory, '.vite-cache'),
  clearScreen: false,
  logLevel: process.env['VE_BENCH_LOG_LEVEL'] === 'warn' ? 'warn' : 'silent',
  plugins: [
    plugin === 'official'
      ? officialVanillaExtractPlugin({identifiers: 'short'})
      : sanityVanillaExtractPlugin({identifiers: 'short'}),
  ],
  build: {
    copyPublicDir: false,
    cssMinify: false,
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
  },
})
