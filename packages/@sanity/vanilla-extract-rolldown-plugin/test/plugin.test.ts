import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown, type OutputAsset, type OutputChunk} from 'rolldown'
import {describe, expect, test} from 'vitest'
import {vanillaExtractPlugin, type Options} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/basic')

async function buildFixture(options?: Options, format: 'esm' | 'cjs' = 'esm') {
  const bundle = await rolldown({
    input: path.join(fixtureDir, 'index.ts'),
    plugins: [vanillaExtractPlugin(options)],
  })
  try {
    // Mirrors the `assetFileNames` used by `@sanity/tsdown-config`, so the extracted CSS keeps a
    // stable name instead of rolldown's default `assets/[name]-[hash][extname]`.
    const {output} = await bundle.generate({format, assetFileNames: '[name][extname]'})
    return output
  } finally {
    await bundle.close()
  }
}

function findAsset(output: readonly (OutputAsset | OutputChunk)[], fileName: string): string {
  const asset = output.find((assetOrChunk) => assetOrChunk.fileName === fileName)
  if (!asset || asset.type !== 'asset') {
    expect.unreachable(`expected an emitted \`${fileName}\` asset`)
  }
  const {source} = asset
  return typeof source === 'string' ? source : new TextDecoder().decode(source)
}

function findEntryChunk(output: readonly (OutputAsset | OutputChunk)[]): OutputChunk {
  const chunk = output.find((assetOrChunk) => assetOrChunk.type === 'chunk')
  if (!chunk || chunk.type !== 'chunk') {
    expect.unreachable('expected an entry chunk')
  }
  return chunk
}

describe('vanillaExtractPlugin', () => {
  test('extracts and minifies the CSS into bundle.css, in import order', async () => {
    const output = await buildFixture()
    const bundleCss = findAsset(output, 'bundle.css')

    // The `rgb(…)` markers in the fixture are minified by lightningcss to hex colors
    expect(bundleCss).toContain('#010203')
    expect(bundleCss).toContain('#040506')
    expect(bundleCss).not.toContain('rgb(1, 2, 3)')

    // `index.ts` imports `button.ts` (which imports `button.css.ts`) before `styles.css.ts`, so
    // the button styles must come first in the extracted bundle
    expect(bundleCss.indexOf('#040506')).toBeLessThan(bundleCss.indexOf('#010203'))
  })

  test('emits a sourcemap and links it from the CSS', async () => {
    const output = await buildFixture()

    expect(findAsset(output, 'bundle.css')).toContain('/*# sourceMappingURL=bundle.css.map*/')
    expect(findAsset(output, 'bundle.css.map')).toContain('"version"')
  })

  test('skips the sourcemap when `extract.sourcemap` is false', async () => {
    const output = await buildFixture({extract: {sourcemap: false}})

    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle.css.map')).toBe(false)
    expect(findAsset(output, 'bundle.css')).not.toContain('sourceMappingURL')
  })

  test('emits the no-op JS shim and its type declarations by default', async () => {
    const output = await buildFixture()

    expect(findAsset(output, 'bundle.css.js')).toContain('export default ""')
    const shimDts = findAsset(output, 'bundle.css.d.ts')
    expect(shimDts).toContain('declare const _default: string')
    expect(shimDts).toContain('export default _default')
  })

  test('skips the shim when `extract.compatMode` is false', async () => {
    const output = await buildFixture({extract: {compatMode: false}})

    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle.css.js')).toBe(false)
    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle.css.d.ts')).toBe(false)
    expect(
      vanillaExtractPlugin({extract: {compatMode: false}}).map((plugin) => plugin.name),
    ).toEqual(['vanilla-extract', 'vanilla-extract:optimize-css'])
  })

  test.each(['esm', 'cjs'] as const)(
    'strips the virtual .vanilla.css imports from the %s output',
    async (format) => {
      const output = await buildFixture(undefined, format)
      const {code} = findEntryChunk(output)

      // The styles must be extracted, not inlined or imported in the JS output
      expect(code).not.toContain('.vanilla.css')
      expect(code).not.toContain('rgb(1, 2, 3)')
      expect(code).not.toContain('#010203')

      // The exported binding should still be present
      expect(code).toContain('getClassNames')
    },
  )

  test('respects a custom `extract.name`', async () => {
    const output = await buildFixture({extract: {name: 'styles.css'}})

    expect(findAsset(output, 'styles.css')).toContain('#010203')
    expect(findAsset(output, 'styles.css')).toContain('/*# sourceMappingURL=styles.css.map*/')
    expect(findAsset(output, 'styles.css.js')).toContain('export default ""')
    expect(findAsset(output, 'styles.css.d.ts')).toContain('declare const _default: string')
  })

  test('keeps the CSS readable when `minify` is false', async () => {
    const output = await buildFixture({minify: false})

    // lightningcss still runs (applying browserslist targets), but without minification the
    // declarations keep their whitespace
    expect(findAsset(output, 'bundle.css')).toContain('padding: 8px')
  })

  test('defaults to short identifiers, and passes `identifiers` through', async () => {
    const [defaultOutput, debugOutput] = await Promise.all([
      buildFixture(),
      buildFixture({identifiers: 'debug'}),
    ])

    // 'short' identifiers are bare hashes, 'debug' ones are prefixed with file and debug names
    expect(findAsset(defaultOutput, 'bundle.css')).not.toContain('styles_box')
    expect(findAsset(debugOutput, 'bundle.css')).toContain('styles_box')
  })
})

describe('plugin hook filters', () => {
  // Regression for https://github.com/vanilla-extract-css/vanilla-extract/issues/1641: the hooks
  // declare filters so rolldown can skip the Rust ↔ JS roundtrip for non-matching modules.
  test('the transform and resolveId hooks declare id filters', () => {
    const [core] = vanillaExtractPlugin()
    if (!core) {
      expect.unreachable('expected the core vanilla-extract plugin')
    }

    expect(core.name).toBe('vanilla-extract')

    const {transform, resolveId} = core
    if (typeof transform !== 'object' || typeof resolveId !== 'object') {
      expect.unreachable('expected the transform and resolveId hooks to be object hooks')
    }
    expect(transform.filter).toMatchObject({id: expect.any(RegExp)})
    expect(resolveId.filter).toMatchObject({id: expect.any(RegExp)})
  })
})
