import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {TsdownPlugin, UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/vanilla-extract-library')

const conditionalCssExport = {
  browser: './dist/bundle.css',
  style: './dist/bundle.css',
  node: './dist/bundle.css.js',
  default: './dist/bundle.css.js',
}

describe('vanilla-extract-library', () => {
  test('extracts and minifies the CSS into bundle.css', async () => {
    const bundleCss = await readFile(path.join(fixtureDir, 'dist/bundle.css'), 'utf-8')

    // The `rgb(1, 2, 3)` marker in `styles.css.ts` is minified by lightningcss to `#010203`
    expect(bundleCss).toContain('#010203')
    expect(bundleCss).not.toContain('rgb(1, 2, 3)')

    // CSS sourcemaps are intentionally skipped, aligned with `@tsdown/css` (and Vite lib mode)
    expect(bundleCss).not.toContain('sourceMappingURL')
    await expect(readFile(path.join(fixtureDir, 'dist/bundle.css.map'), 'utf-8')).rejects.toThrow()
  })

  test("uses tsdown's top-level `target` as the CSS syntax lowering target", async () => {
    const bundleCss = await readFile(path.join(fixtureDir, 'dist/bundle.css'), 'utf-8')

    // The fixture sets `target: 'chrome61'`, which predates the `inset` shorthand used in
    // `styles.css.ts`, so lightningcss must flatten it into `top`/`right`/`bottom`/`left`
    expect(bundleCss).not.toContain('inset:')
    expect(bundleCss).toContain('top:0')
  })

  test('emits the no-op JS shim and its type declarations', async () => {
    const [shim, shimDts] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/bundle.css.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/bundle.css.d.ts'), 'utf-8'),
    ])

    expect(shim).toContain('export default ""')
    expect(shimDts).toContain('declare const _default: string')
    expect(shimDts).toContain('export default _default')
  })

  test('injects the self-referential CSS import into the entry chunks', async () => {
    const [distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])

    // Compat mode injects `import "<pkg>/bundle.css"` (or `require()` for CJS) so consumers load
    // the extracted CSS through the conditional `./bundle.css` export.
    expect(distIndexJs).toContain('import "@fixtures/vanilla-extract-library/bundle.css"')
    expect(distIndexCjs).toContain('require("@fixtures/vanilla-extract-library/bundle.css")')

    // The styles themselves must be extracted, not inlined into the JS output, and the
    // side-effect imports of the virtual `.vanilla.css` modules must be stripped.
    for (const code of [distIndexJs, distIndexCjs]) {
      expect(code).not.toContain('.vanilla.css')
      expect(code).not.toContain('rgb(1, 2, 3)')
      expect(code).not.toContain('#010203')
    }

    // The exported binding should still be present
    expect(distIndexJs).toContain('getBoxClassName')
    expect(distIndexCjs).toContain('getBoxClassName')
  })

  test('does not inject the CSS import into the .d.ts chunks', async () => {
    const [distIndexDts, distIndexDcts] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.d.cts'), 'utf-8'),
    ])

    // (the JSDoc in the fixture source mentions the import, so match actual import statements)
    const cssImportStatement = /^import "@fixtures\/vanilla-extract-library\/bundle\.css"/m
    expect(distIndexDts).not.toMatch(cssImportStatement)
    expect(distIndexDcts).not.toMatch(cssImportStatement)
  })

  test('writes the conditional ./bundle.css export to package.json', async () => {
    const pkg = JSON.parse(await readFile(path.join(fixtureDir, 'package.json'), 'utf-8'))

    expect(pkg.exports['./bundle.css']).toEqual(conditionalCssExport)
    expect(pkg.publishConfig.exports['./bundle.css']).toEqual(conditionalCssExport)

    // The conditional CSS export is inserted before `./package.json`
    expect(Object.keys(pkg.exports)).toEqual(['.', './bundle.css', './package.json'])
  })
})

function getPluginNames(config: UserConfig) {
  const {plugins} = config
  if (!Array.isArray(plugins)) return undefined
  return plugins.map((plugin) =>
    plugin && typeof plugin === 'object' && 'name' in plugin ? plugin.name : undefined,
  )
}

/**
 * Runs the vanilla-extract plugin's `tsdownConfig` hook against the config, like tsdown does when
 * it resolves the user config. This is how the conditional CSS export gets composed into the
 * config's `exports` option.
 */
async function runVanillaExtractConfigHook(config: UserConfig): Promise<UserConfig> {
  const {plugins} = config
  if (!Array.isArray(plugins)) expect.unreachable('expected `plugins` to be an array')
  const plugin: TsdownPlugin | undefined = plugins.find(
    (candidate): candidate is TsdownPlugin =>
      !!candidate &&
      typeof candidate === 'object' &&
      'name' in candidate &&
      candidate.name === 'vanilla-extract',
  )
  if (!plugin || typeof plugin.tsdownConfig !== 'function') {
    expect.unreachable('expected the vanilla-extract plugin with a `tsdownConfig` hook')
  }
  expect(await plugin.tsdownConfig(config, {})).toBeUndefined() // mutates the config in place
  return config
}

describe('vanillaExtract option', () => {
  test('is disabled by default', async () => {
    const config = await defineConfig()

    expect(getPluginNames(config)).toEqual([])

    const {outputOptions} = config
    if (typeof outputOptions !== 'function') {
      expect.unreachable('expected `outputOptions` to be a function')
    }
    // Without vanilla-extract there's no `assetFileNames`/`intro` wiring, only the base options
    expect(await outputOptions({}, 'es', {cjsDts: false})).toEqual({
      chunkFileNames: expect.any(Function),
    })
    expect(config.exports).not.toHaveProperty('customExports')
  })

  test('lazily loads the vanilla-extract plugin when enabled', async () => {
    // The plugin (`@sanity/vanilla-extract-tsdown-plugin`, which pulls in the CSS toolchain)
    // is only dynamically imported when the option is enabled, like `reactCompiler`.
    expect(getPluginNames(await defineConfig({vanillaExtract: true}))).toEqual(['vanilla-extract'])
  })

  test("adds the conditional CSS export through the plugin's `tsdownConfig` hook", async () => {
    // The config itself no longer wires `customExports` - the plugin composes it into the
    // `exports` option when tsdown dispatches its `tsdownConfig` hook.
    const config = await defineConfig({vanillaExtract: true})
    expect(config.exports).not.toHaveProperty('customExports')

    await runVanillaExtractConfigHook(config)

    const exportsOption = config.exports
    if (typeof exportsOption !== 'object' || typeof exportsOption?.customExports !== 'function') {
      expect.unreachable('expected `exports.customExports` to be a function')
    }
    // The config's own exports settings are preserved
    expect(exportsOption).toMatchObject({enabled: 'local-only', devExports: true})

    const result = await exportsOption.customExports(
      {
        '.': './src/index.ts',
        './package.json': './package.json',
      },
      {pkg: {packageJsonPath: 'package.json'}, chunks: {}, isPublish: false},
    )

    expect(result).toEqual({
      '.': './src/index.ts',
      './bundle.css': conditionalCssExport,
      './package.json': './package.json',
    })
    expect(Object.keys(result)).toEqual(['.', './bundle.css', './package.json'])
  })

  test('respects a custom `fileName`', async () => {
    const config = await runVanillaExtractConfigHook(
      await defineConfig({vanillaExtract: {fileName: 'styles.css'}}),
    )

    const exportsOption = config.exports
    if (typeof exportsOption !== 'object' || typeof exportsOption?.customExports !== 'function') {
      expect.unreachable('expected `exports.customExports` to be a function')
    }

    const result = await exportsOption.customExports(
      {'./package.json': './package.json'},
      {pkg: {packageJsonPath: 'package.json'}, chunks: {}, isPublish: true},
    )

    expect(result['./styles.css']).toEqual({
      browser: './dist/styles.css',
      style: './dist/styles.css',
      node: './dist/styles.css.js',
      default: './dist/styles.css.js',
    })
  })

  test('skips the conditional CSS export wiring when `inject` is false', async () => {
    const config = await defineConfig({vanillaExtract: {inject: false}})

    // The vanilla-extract plugin is still applied (it extracts without injecting)…
    expect(getPluginNames(config)).toEqual(['vanilla-extract'])
    // …but its `tsdownConfig` hook leaves the exports wiring alone
    await runVanillaExtractConfigHook(config)
    expect(config.exports).not.toHaveProperty('customExports')
  })
})
