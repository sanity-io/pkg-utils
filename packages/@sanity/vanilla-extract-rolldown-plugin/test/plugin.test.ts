import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown, type OutputAsset, type OutputChunk} from 'rolldown'
import {describe, expect, test} from 'vitest'
import {esbuildTargetToLightningCSS, vanillaExtractPlugin, type Options} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/basic')

/**
 * Without a host-provided package name (`api.setBuildContext`, used by adapters like
 * `@sanity/vanilla-extract-tsdown-plugin`) the plugin resolves the name for the injected
 * self-referential import from the working directory's package.json - in these tests that's
 * this package itself.
 */
const selfReferentialSpecifier = '@sanity/vanilla-extract-rolldown-plugin/bundle.css'

async function buildFixture(
  options?: Options,
  format: 'esm' | 'cjs' = 'esm',
  sourcemap = false,
  fixture = 'basic',
) {
  const bundle = await rolldown({
    input: path.join(__dirname, 'fixtures', fixture, 'index.ts'),
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
  // Filter on `isEntry` instead of taking the first chunk: the output order of a multi-chunk
  // bundle is not contractual, so the first chunk is not guaranteed to be the entry
  const chunk = output.find((assetOrChunk) => assetOrChunk.type === 'chunk' && assetOrChunk.isEntry)
  if (!chunk || chunk.type !== 'chunk') {
    expect.unreachable('expected an entry chunk')
  }
  return chunk
}

describe('vanillaExtractPlugin', () => {
  test('extracts the CSS into bundle.css, in import order', async () => {
    const output = await buildFixture()
    const bundleCss = findAsset(output, 'bundle.css')

    // Like `@tsdown/css` defaults (`minify: false`, no `target`), the CSS keeps its authored
    // form - lightningcss doesn't run at all
    expect(bundleCss).toContain('rgb(1, 2, 3)')
    expect(bundleCss).toContain('rgb(4, 5, 6)')
    expect(bundleCss).toContain('inset: 0')

    // `index.ts` imports `button.ts` (which imports `button.css.ts`) before `styles.css.ts`, so
    // the button styles must come first in the extracted bundle
    expect(bundleCss.indexOf('rgb(4, 5, 6)')).toBeLessThan(bundleCss.indexOf('rgb(1, 2, 3)'))
  })

  test('minifies the CSS with `minify: true`, like `css.minify` in @tsdown/css', async () => {
    const output = await buildFixture({minify: true})
    const bundleCss = findAsset(output, 'bundle.css')

    // The `rgb(…)` markers in the fixture are minified by lightningcss to hex colors
    expect(bundleCss).toContain('#010203')
    expect(bundleCss).toContain('#040506')
    expect(bundleCss).not.toContain('rgb(1, 2, 3)')
  })

  test('does not emit a CSS sourcemap', async () => {
    // Aligned with `@tsdown/css`, which intentionally skips CSS sourcemaps
    // (https://github.com/rolldown/tsdown/issues/472#issuecomment-4017224099) as Vite's build
    // mode doesn't support them either (https://github.com/vitejs/vite/issues/2830)
    const output = await buildFixture()

    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle.css.map')).toBe(false)
    expect(findAsset(output, 'bundle.css')).not.toContain('sourceMappingURL')
  })

  test('does not inject or emit shims by default, like `css.inject` in @tsdown/css', async () => {
    const output = await buildFixture()
    const {code} = findEntryChunk(output)

    // The CSS is extracted, but nothing is injected and no shims are emitted
    expect(findAsset(output, 'bundle.css')).toContain('rgb(1, 2, 3)')
    expect(code).not.toContain('bundle.css')
    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle-css.js')).toBe(false)
    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle-css.d.ts')).toBe(false)

    // The styles must not be inlined or imported in the JS output either
    expect(code).not.toContain('.vanilla.css')
    expect(code).not.toContain('rgb(1, 2, 3)')
    expect(code).not.toContain('#010203')
  })

  test.each(['esm', 'cjs'] as const)(
    'injects a relative CSS import into the %s entry chunk with `inject: true`',
    async (format) => {
      const output = await buildFixture({inject: true}, format)
      const {code} = findEntryChunk(output)

      // Like `css.inject` in `@tsdown/css`: a relative import of the emitted CSS file,
      // and no shim (that's the `nodeCompat` flavor)
      expect(code).toContain(
        format === 'cjs' ? `require("./bundle.css");` : `import "./bundle.css";`,
      )
      expect(code).not.toContain(selfReferentialSpecifier)
      expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle-css.js')).toBe(false)
    },
  )

  test.each(['esm', 'cjs'] as const)(
    'injects the self-referential CSS import into the %s entry chunk with `inject.nodeCompat`',
    async (format) => {
      const output = await buildFixture({inject: {nodeCompat: true}}, format)
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
    const output = await buildFixture({inject: {nodeCompat: true}}, 'esm', true)
    const chunk = findEntryChunk(output)

    expect(chunk.code.startsWith(`import "${selfReferentialSpecifier}";\n`)).toBe(true)
    expect(chunk.map).toBeTruthy()
    expect(chunk.map?.mappings.length).toBeGreaterThan(0)
  })

  test('emits the no-op JS shim and its type declarations with `inject.nodeCompat`', async () => {
    const output = await buildFixture({inject: {nodeCompat: true}})

    // The shim must be free of JS syntax so it parses as both CommonJS and an ES module: the
    // package `type` decides how Node interprets a `.js` file, and the same shim backs the
    // `node`/`default` conditions for `require()` and `import` alike. Named `bundle-css.js`
    // (not `bundle.css.js`) so vanilla-extract's `cssFileFilter` does not match it.
    const shim = findAsset(output, 'bundle-css.js')
    expect(shim).toContain('No-op shim')
    expect(shim.replaceAll(/^\/\/[^\n]*$/gm, '').trim()).toBe('')
    // Declaration for the export's `types` target (the shim); no separate CSS `.d.ts`
    expect(findAsset(output, 'bundle-css.d.ts')).toContain('export {}')
    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'bundle.css.d.ts')).toBe(false)
  })

  test('respects a custom `fileName`', async () => {
    const output = await buildFixture({fileName: 'styles.css', inject: {nodeCompat: true}})

    expect(findAsset(output, 'styles.css')).toContain('rgb(1, 2, 3)')
    expect(findAsset(output, 'styles-css.js')).toContain('No-op shim')
    expect(findAsset(output, 'styles-css.d.ts')).toContain('export {}')
    expect(output.some((assetOrChunk) => assetOrChunk.fileName === 'styles.css.d.ts')).toBe(false)
    expect(findEntryChunk(output).code).toContain(
      'import "@sanity/vanilla-extract-rolldown-plugin/styles.css";',
    )
  })

  test('lowers CSS syntax for esbuild-style `target`s, like `css.target` in @tsdown/css', async () => {
    const [lowered, modern] = await Promise.all([
      buildFixture({target: 'chrome61'}),
      buildFixture({target: false}),
    ])

    // chrome61 predates the `inset` shorthand, so it is flattened into `top`/`right`/…
    expect(findAsset(lowered, 'bundle.css')).not.toContain('inset:')
    expect(findAsset(lowered, 'bundle.css')).toContain('top:')

    // `target: false` disables syntax lowering entirely: lightningcss is skipped, so the CSS
    // keeps its authored form
    expect(findAsset(modern, 'bundle.css')).toContain('inset: 0')
    expect(findAsset(modern, 'bundle.css')).toContain('rgb(1, 2, 3)')
  })

  test('skips syntax lowering for browserless targets, like @tsdown/css', async () => {
    // A JS-runtime-only target (e.g. tsdown's common `target: 'node20'`, resolved from
    // `engines.node`) says nothing about the browsers the extracted CSS runs in, so it
    // converts to no lightningcss targets and syntax lowering is skipped - the same behavior
    // as `@tsdown/css`. (`@sanity/tsdown-config` layers a `@sanity/browserslist-config`
    // default on top through `lightningcss.targets`.)
    const output = await buildFixture({target: 'node20'})
    expect(findAsset(output, 'bundle.css')).toContain('rgb(1, 2, 3)')
    expect(findAsset(output, 'bundle.css')).toContain('inset: 0')

    // The same applies to a browserless default target provided by a host through the
    // adapter API (e.g. tsdown's resolved top-level `target`)
    const plugin = vanillaExtractPlugin()
    plugin.api.setBuildContext({target: ['node20']})
    const bundle = await rolldown({
      input: path.join(fixtureDir, 'index.ts'),
      plugins: [plugin],
    })
    try {
      const {output: inherited} = await bundle.generate({format: 'esm'})
      expect(findAsset(inherited, 'bundle.css')).toContain('rgb(1, 2, 3)')
      expect(findAsset(inherited, 'bundle.css')).toContain('inset: 0')
    } finally {
      await bundle.close()
    }
  })

  test('passes `lightningcss` options through, like `css.lightningcss` in @tsdown/css', async () => {
    const chrome61Targets = esbuildTargetToLightningCSS('chrome61')
    expect(chrome61Targets).toBeTruthy()

    // `lightningcss.targets` drives syntax lowering without an esbuild-style `target`…
    const output = await buildFixture({lightningcss: {targets: chrome61Targets}})
    expect(findAsset(output, 'bundle.css')).not.toContain('inset:')
    expect(findAsset(output, 'bundle.css')).toContain('top:')

    // …and takes precedence over the esbuild-style `target`, matching `@tsdown/css`
    const overridden = await buildFixture({
      target: false,
      lightningcss: {targets: chrome61Targets},
    })
    expect(findAsset(overridden, 'bundle.css')).not.toContain('inset:')

    // The plugin-managed `minify` option wins over its `lightningcss` counterpart: lightningcss
    // runs (its serialization normalizes `rgb(…)` to hex), but the output keeps its whitespace
    const unminified = await buildFixture({lightningcss: {minify: true}})
    expect(findAsset(unminified, 'bundle.css')).toContain('padding: 8px')
    expect(findAsset(unminified, 'bundle.css')).toContain('#010203')
  })

  test('orders dynamically imported CSS after the statically imported CSS', async () => {
    const output = await buildFixture(undefined, 'esm', false, 'dynamic')

    // The dynamic import produces a separate chunk, and `findEntryChunk` picks the entry among
    // them (not whichever chunk happens to come first in the output)…
    expect(output.filter((assetOrChunk) => assetOrChunk.type === 'chunk').length).toBeGreaterThan(1)
    expect(findEntryChunk(output).name).toBe('index')

    // …and its CSS follows the entry's statically imported CSS, matching execution order (the
    // dynamic chunk only loads later at runtime), regardless of the bundle's iteration order
    const bundleCss = findAsset(output, 'bundle.css')
    expect(bundleCss).toContain('rgb(1, 2, 3)')
    expect(bundleCss).toContain('rgb(7, 8, 9)')
    expect(bundleCss.indexOf('rgb(1, 2, 3)')).toBeLessThan(bundleCss.indexOf('rgb(7, 8, 9)'))
  })

  test('emits no CSS or shim for style-less builds, unless `nodeCompat` needs them', async () => {
    // By default (and with a plain `inject: true`), nothing references the CSS file, so an
    // empty one would just be a stray artifact and nothing is emitted
    const withoutInject = await buildFixture(undefined, 'esm', false, 'no-css')
    expect(withoutInject.map((assetOrChunk) => assetOrChunk.fileName)).toEqual(['index.js'])
    const withPlainInject = await buildFixture({inject: true}, 'esm', false, 'no-css')
    expect(withPlainInject.map((assetOrChunk) => assetOrChunk.fileName)).toEqual(['index.js'])

    // With `inject.nodeCompat`, the conditional `./bundle.css` export is written to
    // `package.json` by the host at config-resolution time - before any CSS is known - so the
    // CSS file and its shims are emitted even when empty to keep it resolving
    const withNodeCompat = await buildFixture({inject: {nodeCompat: true}}, 'esm', false, 'no-css')
    expect(withNodeCompat.map((assetOrChunk) => assetOrChunk.fileName).toSorted()).toEqual([
      'bundle-css.d.ts',
      'bundle-css.js',
      'bundle.css',
      'index.js',
    ])
    expect(findAsset(withNodeCompat, 'bundle.css')).toBe('')
    // No import is injected when there are no styles to load
    expect(findEntryChunk(withNodeCompat).code).not.toContain('bundle.css')
  })

  test('warns and still injects when the native magic-string is unavailable', async () => {
    const logs: string[] = []
    const bundle = await rolldown({
      input: path.join(fixtureDir, 'index.ts'),
      plugins: [
        vanillaExtractPlugin({inject: {nodeCompat: true}}),
        {
          name: 'disable-native-magic-string',
          options: (inputOptions) => ({
            ...inputOptions,
            experimental: {...inputOptions.experimental, nativeMagicString: false},
          }),
        },
      ],
      onLog(_level, log) {
        logs.push(log.message)
      },
    })
    try {
      const {output} = await bundle.generate({format: 'esm', sourcemap: true})

      // The import is still injected through the plain string fallback…
      const {code} = findEntryChunk(output)
      expect(code.startsWith(`import "${selfReferentialSpecifier}";\n`)).toBe(true)

      // …but the sourcemap can't be adjusted for it, which is called out instead of failing silently
      expect(logs.some((message) => message.includes('native magic-string is unavailable'))).toBe(
        true,
      )
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

describe('adapter api', () => {
  test('`setBuildContext` provides the package name for the self-referential import', async () => {
    // Hosts resolve the consumer's package name themselves (e.g. tsdown's `config.pkg.name`,
    // forwarded by `@sanity/vanilla-extract-tsdown-plugin`), overriding the package.json lookup
    const plugin = vanillaExtractPlugin({inject: {nodeCompat: true}})
    plugin.api.setBuildContext({packageName: 'some-host-library'})
    const bundle = await rolldown({
      input: path.join(fixtureDir, 'index.ts'),
      plugins: [plugin],
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      expect(findEntryChunk(output).code).toContain('import "some-host-library/bundle.css";')
    } finally {
      await bundle.close()
    }
  })

  test('`setBuildContext` provides the default CSS syntax lowering target', async () => {
    // The `target` option still wins over the host default
    const plugin = vanillaExtractPlugin({target: false})
    plugin.api.setBuildContext({target: 'chrome61'})
    const bundle = await rolldown({
      input: path.join(fixtureDir, 'index.ts'),
      plugins: [plugin],
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      expect(findAsset(output, 'bundle.css')).toContain('inset: 0')
    } finally {
      await bundle.close()
    }

    // Without the `target` option, the host-provided default applies (chrome61 predates the
    // `inset` shorthand, so it is flattened into `top`/`right`/…)
    const hostTargeted = vanillaExtractPlugin()
    hostTargeted.api.setBuildContext({target: 'chrome61'})
    const hostBundle = await rolldown({
      input: path.join(fixtureDir, 'index.ts'),
      plugins: [hostTargeted],
    })
    try {
      const {output} = await hostBundle.generate({format: 'esm'})
      expect(findAsset(output, 'bundle.css')).not.toContain('inset:')
      expect(findAsset(output, 'bundle.css')).toContain('top:')
    } finally {
      await hostBundle.close()
    }
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
