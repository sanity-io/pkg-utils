import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {esbuildTargetToLightningCSS} from '@sanity/vanilla-extract-tsdown-plugin'
import {rolldown} from 'rolldown'
import {x} from 'tinyexec'
import type {TsdownPlugin, UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {defineConfig, type PackageOptions} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/vanilla-extract-library')

/** Runs a JS snippet in a plain Node process, returning its stdout. */
async function runNode(script: string): Promise<string> {
  const result = await x('node', ['-e', script], {throwOnError: true})
  return result.stdout.trim()
}

/**
 * A `file://` URL string for dynamic `import()` in the spawned Node process: a raw absolute
 * path is not a valid ESM specifier on Windows (the drive letter parses as a URL scheme).
 */
function fileUrl(...segments: string[]): string {
  return pathToFileURL(path.join(...segments)).href
}

const conditionalCssExport = {
  browser: './dist/bundle.css',
  style: './dist/bundle.css',
  node: './dist/bundle.css.js',
  default: './dist/bundle.css.js',
}

describe('vanilla-extract-library', () => {
  test('extracts and lowers the CSS into bundle.css', async () => {
    const bundleCss = await readFile(path.join(fixtureDir, 'dist/bundle.css'), 'utf-8')

    // lightningcss processes the CSS (the fixture's chrome61 `target` provides the lowering
    // targets), normalizing the `rgb(1, 2, 3)` marker in `styles.css.ts` to `#010203` - but
    // `minify` now matches the `css.minify` default of `@tsdown/css` (false), so the
    // declarations keep their whitespace
    expect(bundleCss).toContain('#010203')
    expect(bundleCss).not.toContain('rgb(1, 2, 3)')
    expect(bundleCss).toContain('top: 0')

    // CSS sourcemaps are skipped, aligned with `@tsdown/css`
    // (https://github.com/rolldown/tsdown/issues/472#issuecomment-4017224099) and Vite's build
    // mode (https://github.com/vitejs/vite/issues/2830)
    expect(bundleCss).not.toContain('sourceMappingURL')
    await expect(readFile(path.join(fixtureDir, 'dist/bundle.css.map'), 'utf-8')).rejects.toThrow()
  })

  test("uses tsdown's top-level `target` as the CSS syntax lowering target", async () => {
    const bundleCss = await readFile(path.join(fixtureDir, 'dist/bundle.css'), 'utf-8')

    // The fixture sets `target: 'chrome61'`, which predates the `inset` shorthand used in
    // `styles.css.ts`, so lightningcss must flatten it into `top`/`right`/`bottom`/`left`.
    // This also proves the `@sanity/browserslist-config` fallback stayed out of the way: its
    // modern browsers would have kept `inset` as-is.
    expect(bundleCss).not.toContain('inset:')
    expect(bundleCss).toContain('top:')
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
      `import(${JSON.stringify(fileUrl(fixtureDir, 'dist/index.js'))}).then((m) => console.log(m.getBoxClassName()))`,
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
      `import(${JSON.stringify(fileUrl(__dirname, 'fixtures/vanilla-extract-cjs-library/dist/index.mjs'))}).then((m) => console.log(m.getBoxClassName()))`,
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
    // The fixture builds with `target: 'node20'`: a JS-runtime-only target says nothing about
    // the browsers the extracted CSS runs in, so `@sanity/tsdown-config` resolves the CSS
    // syntax lowering targets from `@sanity/browserslist-config` and passes them through
    // `lightningcss.targets`. lightningcss processing the CSS with those targets is observable
    // even without minification, as it normalizes the authored `rgb(1, 2, 3)` to `#010203` -
    // had the node-only target skipped the processing (the way the bare plugin and
    // `@tsdown/css` behave), the authored form would pass through untouched.
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

/**
 * Builds the library fixture's `styles.css.ts` with the vanilla-extract plugin exactly as
 * `defineConfig` wired it up (fallback targets included), returning the extracted CSS. Driving
 * rolldown directly keeps the target-matrix tests fast - the full tsdown pipeline is covered by
 * the fixture builds above.
 */
async function buildCssWithConfig(options: PackageOptions): Promise<string> {
  const config = await defineConfig(options)
  const {plugins} = config
  if (!Array.isArray(plugins)) expect.unreachable('expected `plugins` to be an array')
  const plugin = plugins.find(
    (candidate) =>
      !!candidate &&
      typeof candidate === 'object' &&
      'name' in candidate &&
      candidate.name === 'vanilla-extract',
  )
  if (!plugin) expect.unreachable('expected the vanilla-extract plugin')

  const bundle = await rolldown({
    input: path.join(fixtureDir, 'src/styles.css.ts'),
    plugins: [plugin],
  })
  try {
    const {output} = await bundle.generate({format: 'esm'})
    const asset = output.find((assetOrChunk) => assetOrChunk.fileName === 'bundle.css')
    if (!asset || asset.type !== 'asset') expect.unreachable('expected a `bundle.css` asset')
    const {source} = asset
    return typeof source === 'string' ? source : new TextDecoder().decode(source)
  } finally {
    await bundle.close()
  }
}

describe('vanillaExtract CSS target fallback', () => {
  test('resolves browserless targets from @sanity/browserslist-config', async () => {
    // Without any target, the plugin (like `@tsdown/css`) would skip syntax lowering - the
    // config resolves the lowering targets from `@sanity/browserslist-config` instead.
    // lightningcss processing them is observable through the `rgb(…)` → hex normalization,
    // while `inset` is kept: the config's modern browsers support it (which also tells the
    // fallback apart from explicit old targets like chrome61, which flatten it).
    const css = await buildCssWithConfig({vanillaExtract: true})
    expect(css).toContain('#010203')
    expect(css).not.toContain('rgb(1, 2, 3)')
    expect(css).toContain('inset: 0')
  })

  test('`target: false` disables CSS syntax lowering entirely', async () => {
    // The explicit off switch skips the browserslist fallback too, at both levels: the
    // top-level `target` and `vanillaExtract.target`
    const topLevel = await buildCssWithConfig({target: false, vanillaExtract: true})
    expect(topLevel).toContain('rgb(1, 2, 3)')
    expect(topLevel).toContain('inset: 0')

    const cssLevel = await buildCssWithConfig({vanillaExtract: {target: false}})
    expect(cssLevel).toContain('rgb(1, 2, 3)')
    expect(cssLevel).toContain('inset: 0')
  })

  test('a user-provided `lightningcss.targets` wins over the fallback', async () => {
    // chrome61 predates the `inset` shorthand: it being flattened proves the user's targets
    // applied instead of the fallback's modern browsers
    const css = await buildCssWithConfig({
      vanillaExtract: {lightningcss: {targets: esbuildTargetToLightningCSS('chrome61')}},
    })
    expect(css).not.toContain('inset:')
    expect(css).toContain('top:')
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
