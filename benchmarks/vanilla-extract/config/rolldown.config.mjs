import path from 'node:path'
import {defineConfig} from 'rolldown'
import {vanillaExtractPlugin} from '../.generated/plugins/rolldown-plugin.mjs'

function requiredEnvironmentPath(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return path.resolve(value)
}

const fixtureRoot = requiredEnvironmentPath('VE_BENCH_FIXTURE_ROOT')
const outputDirectory = requiredEnvironmentPath('VE_BENCH_OUTPUT_DIR')

export default defineConfig({
  input: path.join(fixtureRoot, 'src/library.ts'),
  logLevel: 'silent',
  plugins: [
    vanillaExtractPlugin({
      fileName: 'bundle.css',
      identifiers: 'short',
      minify: false,
      target: false,
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
