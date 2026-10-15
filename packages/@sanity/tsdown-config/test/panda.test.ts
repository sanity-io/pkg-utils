import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {Options as PandaPluginOptions} from '@sanity/pandacss-tsdown-plugin'
import {rolldown} from 'rolldown'
import type {ResolvedConfig, TsdownPlugin, UserConfig} from 'tsdown'
import {describe, expect, expectTypeOf, test} from 'vitest'
import {defineConfig, type PackageOptions, type PackagePandaOptions} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/panda')

function getPluginNames(config: UserConfig) {
  const {plugins} = config
  if (!Array.isArray(plugins)) return undefined
  return plugins.map((plugin) =>
    plugin && typeof plugin === 'object' && 'name' in plugin ? plugin.name : undefined,
  )
}

/**
 * Builds the fixture with the Panda plugin exactly as `defineConfig` wired it up (fallback
 * targets included), returning the extracted CSS and the entry chunk's code. Like tsdown, it
 * forwards the resolved top-level `target` through the plugin's `tsdownConfigResolved` hook
 * first.
 */
async function buildWithConfig(options: PackageOptions): Promise<{css: string; entry: string}> {
  const panda = options.panda === true || options.panda === undefined ? {} : options.panda
  const config = await defineConfig({...options, panda: {cwd: fixtureDir, ...panda}})
  const {plugins} = config
  if (!Array.isArray(plugins)) expect.unreachable('expected `plugins` to be an array')
  const plugin = plugins.find(
    (candidate): candidate is TsdownPlugin =>
      !!candidate &&
      typeof candidate === 'object' &&
      'name' in candidate &&
      candidate.name === 'pandacss',
  )
  if (!plugin) expect.unreachable('expected the pandacss plugin')
  const target = typeof config.target === 'string' ? [config.target] : config.target || undefined
  const logger = {info: () => {}, warn: () => {}}
  await plugin.tsdownConfigResolved?.({cwd: fixtureDir, logger, target} as ResolvedConfig)

  const bundle = await rolldown({
    input: path.join(fixtureDir, 'src/index.ts'),
    external: [/styled-system/],
    plugins: [plugin],
  })
  try {
    const {output} = await bundle.generate({format: 'esm'})
    const asset = output.find((assetOrChunk) => assetOrChunk.fileName === 'styles.css')
    if (!asset || asset.type !== 'asset') expect.unreachable('expected a `styles.css` asset')
    const entry = output.find(
      (assetOrChunk) => assetOrChunk.type === 'chunk' && assetOrChunk.isEntry,
    )
    if (!entry || entry.type !== 'chunk') expect.unreachable('expected an entry chunk')
    const {source} = asset
    return {
      css: typeof source === 'string' ? source : new TextDecoder().decode(source),
      entry: entry.code,
    }
  } finally {
    await bundle.close()
  }
}

async function buildCssWithConfig(options: PackageOptions): Promise<string> {
  return (await buildWithConfig(options)).css
}

describe('panda option', () => {
  test('`PackagePandaOptions` stays the same type as the plugin options', () => {
    // Defined separately so the declarations don't reference the optional peer
    expectTypeOf<PackagePandaOptions>().toEqualTypeOf<PandaPluginOptions>()
  })

  test('transforms the style calls by default, unless `transform: false`', async () => {
    // Unlike `@pandacss/vite`, where `transform` defaults to `false`
    const importsRuntime = /from ["']\.\.\/styled-system\/css["']/
    expect((await buildWithConfig({panda: true})).entry).not.toMatch(importsRuntime)
    expect((await buildWithConfig({panda: {transform: true}})).entry).not.toMatch(importsRuntime)
    expect((await buildWithConfig({panda: {transform: false}})).entry).toMatch(importsRuntime)
  })

  test('lazily loads the panda plugin when enabled', async () => {
    expect(getPluginNames(await defineConfig())).toEqual([])
    expect(getPluginNames(await defineConfig({panda: true}))).toEqual(['pandacss'])
  })

  test('rejects a stylesheet name another CSS option already emits', async () => {
    // Each plugin emits its own stylesheet and export subpath, without merging the other's CSS
    await expect(
      defineConfig({vanillaExtract: true, panda: {fileName: 'bundle.css'}}),
    ).rejects.toThrow(
      '`panda` and `vanillaExtract` would both emit "bundle.css", and neither merges the other\'s CSS. Set a distinct `fileName` for one of them',
    )
    await expect(
      defineConfig({vanillaExtract: {fileName: './styles.css'}, panda: true}),
    ).rejects.toThrow('`panda` and `vanillaExtract` would both emit "./styles.css"')
    await expect(defineConfig({css: {fileName: 'styles.css'}, panda: true})).rejects.toThrow(
      '`panda` and `css` would both emit "styles.css"',
    )

    // The default names differ, and split `@tsdown/css` output is named after its chunks
    expect(getPluginNames(await defineConfig({vanillaExtract: true, panda: true}))).toContain(
      'pandacss',
    )
    expect(
      getPluginNames(
        await defineConfig({css: {fileName: 'styles.css', splitting: true}, panda: true}),
      ),
    ).toContain('pandacss')
  })

  test('resolves browserless targets from @sanity/browserslist-config', async () => {
    // The browserslist targets still need the `-webkit-` prefix for `backdrop-filter`, while
    // the plugin on its own (like `@tsdown/css`) skips syntax lowering without a target
    const css = await buildCssWithConfig({panda: true})
    expect(css).toContain('-webkit-backdrop-filter: blur(4px)')
    expect(css).toContain('padding-inline: 8px')
  })

  test('forwards the top-level `target`, unless `target: false`', async () => {
    const lowered = await buildCssWithConfig({target: 'chrome61', panda: true})
    expect(lowered).toContain('padding-left: 8px')
    expect(lowered).not.toContain('padding-inline:')

    const topLevel = await buildCssWithConfig({target: false, panda: true})
    expect(topLevel).not.toContain('-webkit-backdrop-filter')
    expect(topLevel).toContain('padding-inline: 8px')

    const pandaLevel = await buildCssWithConfig({target: 'chrome61', panda: {target: false}})
    expect(pandaLevel).not.toContain('-webkit-backdrop-filter')
    expect(pandaLevel).toContain('padding-inline: 8px')
  })

  test('resolves browserslist queries in `panda.target` instead of the fallback', async () => {
    // `chrome 61` is a browserslist query (esbuild's format has no space), not a target that
    // names no browsers
    const query = await buildCssWithConfig({panda: {target: 'chrome 61'}})
    expect(query).toContain('padding-left: 8px')
    expect(query).not.toContain('-webkit-backdrop-filter')

    // Mixed with esbuild-style targets, each browser keeps its lowest version
    const mixed = await buildCssWithConfig({panda: {target: ['chrome120', 'chrome 61']}})
    expect(mixed).toContain('padding-left: 8px')

    // A query that names no browsers still gets the fallback
    const node = await buildCssWithConfig({panda: {target: 'node 20'}})
    expect(node).toContain('-webkit-backdrop-filter: blur(4px)')

    // Explicit `lightningcss.targets` still win
    const explicit = await buildCssWithConfig({
      panda: {target: 'chrome 61', lightningcss: {targets: {chrome: 120 << 16}}},
    })
    expect(explicit).toContain('padding-inline: 8px')
  })

  test('a user-provided `lightningcss.targets` wins over the fallback', async () => {
    const css = await buildCssWithConfig({panda: {lightningcss: {targets: {chrome: 61 << 16}}}})
    expect(css).toContain('padding-left: 8px')
  })

  test('minifies only when `minify: true` is set, and always strips the panda marker', async () => {
    const readable = await buildCssWithConfig({panda: true})
    expect(readable).toContain('padding-inline: 8px')
    expect(readable).not.toContain('--made-with-panda')

    const minified = await buildCssWithConfig({panda: {minify: true}})
    expect(minified).toContain('padding-inline:8px')
    expect(minified).not.toContain('--made-with-panda')
  })
})
