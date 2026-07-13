import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown, type OutputAsset, type OutputChunk} from 'rolldown'
import type {ResolvedConfig, UserConfig} from 'tsdown'
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
    // Aligned with `@tsdown/css`, which intentionally skips CSS sourcemaps
    // (https://github.com/rolldown/tsdown/issues/472#issuecomment-4017224099) as Vite's build
    // mode doesn't support them either (https://github.com/vitejs/vite/issues/2830)
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

    // `target: false` disables syntax lowering entirely: lightningcss is skipped, so the CSS
    // keeps its authored form
    expect(findAsset(modern, 'bundle.css')).toContain('inset: 0')
    expect(findAsset(modern, 'bundle.css')).toContain('rgb(1, 2, 3)')
  })

  test('falls back to @sanity/browserslist-config when the target has no browsers', async () => {
    // A JS-runtime-only target (e.g. tsdown's common `target: 'node20'`, which says nothing
    // about the browsers the extracted CSS runs in) falls back to the browserslist defaults
    // instead of silently skipping syntax lowering the way `@tsdown/css` does. lightningcss
    // running (with the fallback targets) is observable even without minification: it
    // normalizes the authored `rgb(1, 2, 3)` to `#010203`, unlike `target: false` above.
    const output = await buildFixture({target: 'node20', minify: false})
    expect(findAsset(output, 'bundle.css')).toContain('#010203')
    expect(findAsset(output, 'bundle.css')).not.toContain('rgb(1, 2, 3)')

    // The same applies to a browserless top-level `target` inherited from tsdown
    const plugin = vanillaExtractPlugin({minify: false})
    await plugin.tsdownConfigResolved?.({
      target: ['node20'],
    } as Partial<ResolvedConfig> as ResolvedConfig)
    const bundle = await rolldown({
      input: path.join(fixtureDir, 'index.ts'),
      plugins: [plugin],
    })
    try {
      const {output: inherited} = await bundle.generate({format: 'esm'})
      expect(findAsset(inherited, 'bundle.css')).toContain('#010203')
      expect(findAsset(inherited, 'bundle.css')).not.toContain('rgb(1, 2, 3)')
    } finally {
      await bundle.close()
    }
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

const conditionalCssExport = {
  browser: './dist/bundle.css',
  style: './dist/bundle.css',
  node: './dist/bundle.css.js',
  default: './dist/bundle.css.js',
}

/** Runs the plugin's `tsdownConfig` hook against a tsdown user config, like tsdown does. */
async function runTsdownConfigHook(config: UserConfig, options?: Options): Promise<UserConfig> {
  const plugin = vanillaExtractPlugin(options)
  expect(typeof plugin.tsdownConfig).toBe('function')
  const result = await plugin.tsdownConfig?.(config, {})
  expect(result).toBeUndefined() // the hook mutates the config in place
  return config
}

/** Resolves the `customExports` function the hook composed into the `exports` option. */
function getCustomExports(config: UserConfig) {
  const exportsOption = config.exports
  if (typeof exportsOption !== 'object' || typeof exportsOption?.customExports !== 'function') {
    expect.unreachable('expected `exports.customExports` to be a function')
  }
  return exportsOption.customExports
}

const customExportsContext = {
  pkg: {packageJsonPath: 'package.json'},
  chunks: {},
  isPublish: false,
}

describe('tsdownConfig hook', () => {
  test('writes the conditional CSS export through `exports.customExports`', async () => {
    const config = await runTsdownConfigHook({exports: {enabled: 'local-only'}})
    const customExports = getCustomExports(config)

    const result = await customExports(
      {'.': './src/index.ts', './package.json': './package.json'},
      customExportsContext,
    )

    // The conditional CSS export is inserted before `./package.json`
    expect(result).toEqual({
      '.': './src/index.ts',
      './bundle.css': conditionalCssExport,
      './package.json': './package.json',
    })
    expect(Object.keys(result)).toEqual(['.', './bundle.css', './package.json'])
  })

  test('normalizes the boolean and CI-condition forms of the `exports` option', async () => {
    const enabled = await runTsdownConfigHook({exports: true})
    expect(await getCustomExports(enabled)({}, customExportsContext)).toEqual({
      './bundle.css': conditionalCssExport,
    })

    const ciOnly = await runTsdownConfigHook({exports: 'ci-only'})
    expect(ciOnly.exports).toMatchObject({enabled: 'ci-only'})
    expect(await getCustomExports(ciOnly)({}, customExportsContext)).toEqual({
      './bundle.css': conditionalCssExport,
    })
  })

  test('composes with a pre-existing `customExports`', async () => {
    // Function form: applied first, then the conditional CSS export is inserted
    const withFunction = await runTsdownConfigHook({
      exports: {customExports: (exports) => ({...exports, './worker.js': './dist/worker.js'})},
    })
    expect(
      await getCustomExports(withFunction)({'.': './dist/index.mjs'}, customExportsContext),
    ).toEqual({
      '.': './dist/index.mjs',
      './worker.js': './dist/worker.js',
      './bundle.css': conditionalCssExport,
    })

    // Record form: merged like tsdown itself does
    const withRecord = await runTsdownConfigHook({
      exports: {customExports: {'./worker.js': './dist/worker.js'}},
    })
    expect(
      await getCustomExports(withRecord)({'.': './dist/index.mjs'}, customExportsContext),
    ).toEqual({
      '.': './dist/index.mjs',
      './worker.js': './dist/worker.js',
      './bundle.css': conditionalCssExport,
    })
  })

  test('respects `fileName` and the configured `outDir`', async () => {
    const config = await runTsdownConfigHook(
      {exports: true, outDir: 'lib'},
      {
        fileName: 'styles.css',
      },
    )

    expect(await getCustomExports(config)({}, customExportsContext)).toEqual({
      './styles.css': {
        browser: './lib/styles.css',
        style: './lib/styles.css',
        node: './lib/styles.css.js',
        default: './lib/styles.css.js',
      },
    })
  })

  test('leaves the `exports` option untouched when disabled, or when `inject` is false', async () => {
    // tsdown's exports feature is opt-in: the conditional export is only written when enabled
    expect((await runTsdownConfigHook({})).exports).toBeUndefined()
    expect((await runTsdownConfigHook({exports: false})).exports).toBe(false)

    // `inject: false` skips the wiring entirely
    const config = await runTsdownConfigHook({exports: {enabled: 'local-only'}}, {inject: false})
    expect(config.exports).not.toHaveProperty('customExports')
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
