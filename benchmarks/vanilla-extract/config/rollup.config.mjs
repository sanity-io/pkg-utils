import path from 'node:path'
import {vanillaExtractPlugin} from '@vanilla-extract/rollup-plugin'

function requiredEnvironmentPath(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return path.resolve(value)
}

const fixtureRoot = requiredEnvironmentPath('VE_BENCH_FIXTURE_ROOT')
const outputDirectory = requiredEnvironmentPath('VE_BENCH_OUTPUT_DIR')

export default {
  input: path.join(fixtureRoot, 'src/library.ts'),
  plugins: [
    vanillaExtractPlugin({
      cwd: fixtureRoot,
      extract: {
        name: 'bundle.css',
        sourcemap: false,
      },
      identifiers: 'short',
    }),
  ],
  output: {
    assetFileNames: '[name][extname]',
    dir: outputDirectory,
    entryFileNames: 'index.mjs',
    format: 'es',
    sourcemap: false,
  },
}
