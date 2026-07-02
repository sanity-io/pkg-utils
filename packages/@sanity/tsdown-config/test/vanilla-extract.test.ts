import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
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

    // `extract.sourcemap` defaults to true, so a sourcemap is emitted and linked
    expect(bundleCss).toContain('/*# sourceMappingURL=bundle.css.map*/')
    await expect(
      readFile(path.join(fixtureDir, 'dist/bundle.css.map'), 'utf-8'),
    ).resolves.toContain('"version"')
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

describe('defineConfig', () => {
  test('leaves the config untouched when `vanillaExtract` is not enabled', () => {
    const config = defineConfig()

    expect(config.plugins).toBeUndefined()
    expect(config.outputOptions).toEqual({hoistTransitiveImports: false})
    expect(config.exports).not.toHaveProperty('customExports')
  })

  test('adds the conditional CSS export through `exports.customExports`', async () => {
    const config = defineConfig({vanillaExtract: true})

    expect(config.plugins).toBeDefined()

    const exportsOption = config.exports
    if (typeof exportsOption !== 'object' || typeof exportsOption?.customExports !== 'function') {
      expect.unreachable('expected `exports.customExports` to be a function')
    }

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

  test('respects a custom `extract.name`', async () => {
    const config = defineConfig({vanillaExtract: {extract: {name: 'styles.css'}}})

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

  test('skips the compat mode wiring when `extract.compatMode` is false', () => {
    const config = defineConfig({vanillaExtract: {extract: {compatMode: false}}})

    // The vanilla-extract + optimize-css plugins are still applied…
    expect(config.plugins).toBeDefined()
    // …but the exports wiring is not
    expect(config.exports).not.toHaveProperty('customExports')
  })
})
