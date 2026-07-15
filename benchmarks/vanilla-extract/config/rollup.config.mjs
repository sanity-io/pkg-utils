import path from 'node:path'

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
const {vanillaExtractPlugin} = await import('@vanilla-extract/rollup-plugin')

/**
 * The official rollup plugin's extract mode emits raw CSS with no minify/target support of its
 * own, so real-world official pipelines (e.g. `@sanity/pkg-utils`'s `optimizeCss`) add a
 * `lightningcss` pass over the emitted asset. This post-plugin replicates that so the minify and
 * target variants compare complete pipelines, not a no-op against real work.
 */
async function createLightningcssPostPlugin() {
  const {transform} = await import('lightningcss')
  // esbuild-style `chrome61` in lightningcss target encoding (major version << 16)
  const targets = target === 'chrome61' ? {chrome: 61 << 16} : undefined
  if (target && !targets) throw new Error(`Unsupported VE_BENCH_TARGET: ${target}`)

  return {
    name: 'benchmark-lightningcss',
    generateBundle(_options, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== 'asset' || !fileName.endsWith('.css')) continue
        const {code} = transform({
          filename: fileName,
          code: Buffer.from(output.source),
          minify,
          targets,
        })
        output.source = code.toString()
      }
    },
  }
}

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
    (minify || target) && (await createLightningcssPostPlugin()),
  ].filter(Boolean),
  output: {
    assetFileNames: '[name][extname]',
    dir: outputDirectory,
    entryFileNames: 'index.mjs',
    format: 'es',
    sourcemap: false,
  },
}
