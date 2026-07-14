import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {x} from 'tinyexec'
import type {TsdownPlugin, UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/vanilla-extract-library')

/** Runs a JS snippet in a plain Node process, returning its stdout. */
async function runNode(script: string): Promise<string> {
  const result = await x('node', ['-e', script], {throwOnError: true})
  return result.stdout.trim()
}

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

    // CSS sourcemaps are skipped, aligned with `@tsdown/css`
    // (https://github.com/rolldown/tsdown/issues/472#issuecomment-4017224099) and Vite's build
    // mode (https://github.com/vitejs/vite/issues/2830)
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

    // The shim must be free of JS syntax so it parses as both CommonJS and an ES module,
    // regardless of the package `type` (the cjs-library fixture covers this at runtime)
    expect(shim).toContain('No-op shim')
    expect(shim.replaceAll(/^\/\/[^\n]*$/gm, '').trim()).toBe('')
    expect(shimDts).toContain('export {}')
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

describe('vanilla-extract-library runtime', () => {
  // `"type": "module"` package: `.js` files are ESM, so the `node`/`default` conditions of the
  // conditional `./bundle.css` export resolve the shim as an ES module.
  test.each([
    [
      'import()',
      `import(${JSON.stringify(path.join(fixtureDir, 'dist/index.js'))}).then((m) => console.log(m.getBoxClassName()))`,
    ],
    [
      'require()',
      `console.log(require(${JSON.stringify(path.join(fixtureDir, 'dist/index.cjs'))}).getBoxClassName())`,
    ],
  ])('the built output loads in plain Node via %s', async (_loader, script) => {
    // The injected self-referential `@fixtures/vanilla-extract-library/bundle.css` import
    // resolves through the conditional export to the no-op shim instead of crashing on the
    // `.css` file, and the class name export still works
    await expect(runNode(script)).resolves.toMatch(/^\w+$/)
  })
})

describe('vanilla-extract-cjs-library', () => {
  const cjsFixtureDir = path.resolve(__dirname, 'fixtures/vanilla-extract-cjs-library')

  test('injects the self-referential CSS import into the entry chunks', async () => {
    const [distIndexJs, distIndexMjs] = await Promise.all([
      readFile(path.join(cjsFixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(cjsFixtureDir, 'dist/index.mjs'), 'utf-8'),
    ])

    // In a `"type": "commonjs"` package the `.js` build is CJS and the `.mjs` build is ESM
    expect(distIndexJs).toContain('require("@fixtures/vanilla-extract-cjs-library/bundle.css")')
    expect(distIndexMjs).toContain('import "@fixtures/vanilla-extract-cjs-library/bundle.css"')
  })

  // Regression: the shim used to be authored as ESM (`export default ""`), which a
  // `"type": "commonjs"` package parses as CommonJS - so the injected
  // `require("<pkg>/bundle.css")` crashed with `SyntaxError: Unexpected token 'export'`. The
  // shim is now free of JS syntax and parses in both module systems.
  test.each([
    [
      'require()',
      `console.log(require(${JSON.stringify(path.join(__dirname, 'fixtures/vanilla-extract-cjs-library/dist/index.js'))}).getBoxClassName())`,
    ],
    [
      'import()',
      `import(${JSON.stringify(path.join(__dirname, 'fixtures/vanilla-extract-cjs-library/dist/index.mjs'))}).then((m) => console.log(m.getBoxClassName()))`,
    ],
  ])('the built output loads in plain Node via %s', async (_loader, script) => {
    await expect(runNode(script)).resolves.toMatch(/^\w+$/)
  })

  test('writes the conditional ./bundle.css export to package.json', async () => {
    const pkg = JSON.parse(await readFile(path.join(cjsFixtureDir, 'package.json'), 'utf-8'))

    expect(pkg.exports['./bundle.css']).toEqual(conditionalCssExport)
    expect(pkg.publishConfig.exports['./bundle.css']).toEqual(conditionalCssExport)
  })
})

describe('vanilla-extract-node-target-library', () => {
  const nodeTargetFixtureDir = path.resolve(
    __dirname,
    'fixtures/vanilla-extract-node-target-library',
  )

  test('falls back to @sanity/browserslist-config for the node-only `target`', async () => {
    // The fixture builds with `target: 'node20'` and `minify: false`: a JS-runtime-only target
    // says nothing about the browsers the extracted CSS runs in, so the CSS syntax lowering
    // targets fall back to `@sanity/browserslist-config`. lightningcss processing the CSS with
    // those targets is observable even without minification, as it normalizes the authored
    // `rgb(1, 2, 3)` to `#010203` - had the node-only target disabled the processing (the way
    // `@tsdown/css` behaves), the authored form would pass through untouched.
    const bundleCss = await readFile(path.join(nodeTargetFixtureDir, 'dist/bundle.css'), 'utf-8')
    expect(bundleCss).toContain('#010203')
    expect(bundleCss).not.toContain('rgb(1, 2, 3)')
  })

  test('lowers CSS syntax for the fallback browserslist targets', async () => {
    // `light-dark()` is not supported by all browsers of `@sanity/browserslist-config`, so
    // lightningcss lowers it to its custom-property polyfill. (Once every browser in the
    // browserslist query supports `light-dark()` this marker stops being lowered - swap it for
    // a newer CSS feature if this assertion starts failing after a caniuse-lite update.)
    const bundleCss = await readFile(path.join(nodeTargetFixtureDir, 'dist/bundle.css'), 'utf-8')
    expect(bundleCss).not.toContain('light-dark(')
    expect(bundleCss).toContain('var(--lightningcss-light')
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

    // Without vanilla-extract there's no `assetFileNames`/`intro` wiring, and `outputOptions` is
    // left to tsdown's defaults
    expect(config.outputOptions).toBeUndefined()
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
