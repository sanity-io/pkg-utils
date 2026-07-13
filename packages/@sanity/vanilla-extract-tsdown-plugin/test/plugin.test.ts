import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown, type OutputAsset, type OutputChunk} from 'rolldown'
import {describe, expect, test} from 'vitest'
import {vanillaExtractPlugin, type Options} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/basic')

/**
 * Outside tsdown (which provides the package name via its `tsdownConfigResolved` hook) the
 * plugin resolves the name for the injected self-referential import from the working
 * directory's package.json - in these tests that's this package itself.
 */
const selfReferentialSpecifier = '@sanity/vanilla-extract-tsdown-plugin/bundle.css'

async function buildFixture(options?: Options, format: 'esm' | 'cjs' = 'esm', sourcemap = false) {
  const bundle = await rolldown({
    input: path.join(fixtureDir, 'index.ts'),
    plugins: [vanillaExtractPlugin(options)],
  })
  try {
    const {output} = await bundle.generate({format, sourcemap})
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

  test('does not emit a CSS sourcemap', async () => {
    // Aligned with `@tsdown/css` (and Vite lib mode), which intentionally skip CSS sourcemaps
    const output = await buildFixture()

    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle.css.map')).toBe(false)
    expect(findAsset(output, 'bundle.css')).not.toContain('sourceMappingURL')
  })

  test.each(['esm', 'cjs'] as const)(
    'injects the self-referential CSS import into the %s entry chunk',
    async (format) => {
      const output = await buildFixture(undefined, format)
      const {code} = findEntryChunk(output)

      expect(code).toContain(
        format === 'cjs'
          ? `require("${selfReferentialSpecifier}");`
          : `import "${selfReferentialSpecifier}";`,
      )

      // The styles must be extracted, not inlined or imported in the JS output
      expect(code).not.toContain('.vanilla.css')
      expect(code).not.toContain('rgb(1, 2, 3)')
      expect(code).not.toContain('#010203')

      // The exported binding should still be present
      expect(code).toContain('getClassNames')
    },
  )

  test('keeps the JS sourcemap intact when injecting (native magic-string)', async () => {
    const output = await buildFixture(undefined, 'esm', true)
    const chunk = findEntryChunk(output)

    expect(chunk.code.startsWith(`import "${selfReferentialSpecifier}";\n`)).toBe(true)
    expect(chunk.map).toBeTruthy()
    expect(chunk.map?.mappings.length).toBeGreaterThan(0)
  })

  test('emits the no-op JS shim and its type declarations by default', async () => {
    const output = await buildFixture()

    expect(findAsset(output, 'bundle.css.js')).toContain('export default ""')
    const shimDts = findAsset(output, 'bundle.css.d.ts')
    expect(shimDts).toContain('declare const _default: string')
    expect(shimDts).toContain('export default _default')
  })

  test('skips the import and shim when `inject` is false', async () => {
    const output = await buildFixture({inject: false})

    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle.css.js')).toBe(false)
    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle.css.d.ts')).toBe(false)
    expect(findEntryChunk(output).code).not.toContain(selfReferentialSpecifier)

    // The CSS itself is still extracted
    expect(findAsset(output, 'bundle.css')).toContain('#010203')
  })

  test('respects a custom `fileName`', async () => {
    const output = await buildFixture({fileName: 'styles.css'})

    expect(findAsset(output, 'styles.css')).toContain('#010203')
    expect(findAsset(output, 'styles.css.js')).toContain('export default ""')
    expect(findAsset(output, 'styles.css.d.ts')).toContain('declare const _default: string')
    expect(findEntryChunk(output).code).toContain(
      'import "@sanity/vanilla-extract-tsdown-plugin/styles.css";',
    )
  })

  test('keeps the CSS readable when `minify` is false', async () => {
    const output = await buildFixture({minify: false})

    // lightningcss still runs (applying the syntax lowering targets), but without minification
    // the declarations keep their whitespace
    expect(findAsset(output, 'bundle.css')).toContain('padding: 8px')
  })

  test('lowers CSS syntax for esbuild-style `target`s, like `css.target` in @tsdown/css', async () => {
    const [lowered, modern] = await Promise.all([
      buildFixture({target: 'chrome61'}),
      buildFixture({target: false, minify: false}),
    ])

    // chrome61 predates the `inset` shorthand, so it is flattened into `top`/`right`/…
    expect(findAsset(lowered, 'bundle.css')).not.toContain('inset:')
    expect(findAsset(lowered, 'bundle.css')).toContain('top:')

    // `target: false` disables syntax lowering entirely
    expect(findAsset(modern, 'bundle.css')).toContain('inset: 0')
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
  test('the transform, resolveId and load hooks declare id filters', () => {
    const plugin = vanillaExtractPlugin()

    expect(plugin.name).toBe('vanilla-extract')

    const {transform, resolveId, load} = plugin
    if (
      typeof transform !== 'object' ||
      typeof resolveId !== 'object' ||
      typeof load !== 'object'
    ) {
      expect.unreachable('expected the transform, resolveId and load hooks to be object hooks')
    }
    expect(transform.filter).toMatchObject({id: expect.any(RegExp)})
    expect(resolveId.filter).toMatchObject({id: expect.any(RegExp)})
    expect(load.filter).toMatchObject({id: expect.any(RegExp)})
  })
})
