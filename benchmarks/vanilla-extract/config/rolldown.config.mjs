import path from 'node:path'
import {defineConfig} from 'rolldown'

function requiredEnvironmentPath(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return path.resolve(value)
}

const fixtureRoot = requiredEnvironmentPath('VE_BENCH_FIXTURE_ROOT')
const outputDirectory = requiredEnvironmentPath('VE_BENCH_OUTPUT_DIR')
const minify = process.env['VE_BENCH_MINIFY'] === '1'
const target = process.env['VE_BENCH_TARGET'] || false

// Lazy-loaded so this process only ever evaluates the plugin under test.
const {vanillaExtractPlugin} = await import('../.generated/plugins/rolldown-plugin.mjs')

export default defineConfig({
  input: path.join(fixtureRoot, 'src/library.ts'),
  logLevel: 'silent',
  plugins: [
    vanillaExtractPlugin({
      fileName: 'bundle.css',
      identifiers: 'short',
      minify,
      target,
    }),
  ],
  output: {
    assetFileNames: '[name][extname]',
    dir: outputDirectory,
    entryFileNames: 'index.mjs',
    format: 'esm',
    sourcemap: false,
  },
})
