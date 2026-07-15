import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown, type OutputAsset, type OutputChunk} from 'rolldown'
import type {ResolvedConfig, UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {vanillaExtractPlugin, type Options} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/basic')

function findAsset(output: readonly (OutputAsset | OutputChunk)[], fileName: string): string {
  const asset = output.find((assetOrChunk) => assetOrChunk.fileName === fileName)
  if (!asset || asset.type !== 'asset') {
    expect.unreachable(`expected an emitted \`${fileName}\` asset`)
  }
  const {source} = asset
  return typeof source === 'string' ? source : new TextDecoder().decode(source)
}

function findEntryChunk(output: readonly (OutputAsset | OutputChunk)[]): OutputChunk {
  const chunk = output.find((assetOrChunk) => assetOrChunk.type === 'chunk' && assetOrChunk.isEntry)
  if (!chunk || chunk.type !== 'chunk') {
    expect.unreachable('expected an entry chunk')
  }
  return chunk
}

describe('vanillaExtractPlugin', () => {
  test('extracts the CSS through the wrapped rolldown plugin', async () => {
    // The compilation, hook filters, and extraction all come from
    // `@sanity/vanilla-extract-rolldown-plugin` - this asserts the wiring, the behaviors
    // themselves are covered by that package's tests.
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

    const bundle = await rolldown({
      input: path.join(fixtureDir, 'index.ts'),
      plugins: [plugin],
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      expect(findAsset(output, 'bundle.css')).toContain('rgb(1, 2, 3)')
    } finally {
      await bundle.close()
    }
  })

  test("`tsdownConfigResolved` forwards tsdown's package name and `target`", async () => {
    // The self-referential import of `inject.nodeCompat` uses the package name tsdown resolved
    // (instead of reading package.json from the working directory), and the CSS syntax lowering
    // target defaults to tsdown's resolved top-level `target`.
    const plugin = vanillaExtractPlugin({inject: {nodeCompat: true}})
    await plugin.tsdownConfigResolved?.({
      target: ['chrome61'],
      pkg: {name: '@fixtures/host-library'},
      cwd: fixtureDir,
    } as Partial<ResolvedConfig> as ResolvedConfig)

    const bundle = await rolldown({
      input: path.join(fixtureDir, 'index.ts'),
      plugins: [plugin],
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})

      expect(findEntryChunk(output).code).toContain('import "@fixtures/host-library/bundle.css";')

      // chrome61 predates the `inset` shorthand, so it is flattened into `top`/`right`/…
      const bundleCss = findAsset(output, 'bundle.css')
      expect(bundleCss).not.toContain('inset:')
      expect(bundleCss).toContain('top:')
    } finally {
      await bundle.close()
    }
  })
})

const conditionalCssExport = {
  browser: './dist/bundle.css',
  style: './dist/bundle.css',
  node: './dist/bundle-css.js',
  default: './dist/bundle-css.js',
}

/** Runs the plugin's `tsdownConfig` hook against a tsdown user config, like tsdown does. */
async function runTsdownConfigHook(
  config: UserConfig,
  options: Options = {inject: {nodeCompat: true}},
): Promise<UserConfig> {
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
      {fileName: 'styles.css', inject: {nodeCompat: true}},
    )

    expect(await getCustomExports(config)({}, customExportsContext)).toEqual({
      './styles.css': {
        browser: './lib/styles.css',
        style: './lib/styles.css',
        node: './lib/styles-css.js',
        default: './lib/styles-css.js',
      },
    })
  })

  test('leaves the `exports` option untouched when disabled, or without `nodeCompat`', async () => {
    // tsdown's exports feature is opt-in: the conditional export is only written when enabled
    expect((await runTsdownConfigHook({})).exports).toBeUndefined()
    expect((await runTsdownConfigHook({exports: false})).exports).toBe(false)

    // Only the `nodeCompat` flavor of `inject` writes the conditional export: the default and
    // the plain relative-import flavor leave the `exports` option alone
    const withDefaults = await runTsdownConfigHook({exports: {enabled: 'local-only'}}, {})
    expect(withDefaults.exports).not.toHaveProperty('customExports')
    const withPlainInject = await runTsdownConfigHook(
      {exports: {enabled: 'local-only'}},
      {inject: true},
    )
    expect(withPlainInject.exports).not.toHaveProperty('customExports')
  })
})
