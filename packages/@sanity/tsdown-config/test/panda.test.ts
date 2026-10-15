import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import type {Options as PandaPluginOptions} from '@sanity/pandacss-tsdown-plugin'
import {rolldown} from 'rolldown'
import type {ResolvedConfig, TsdownPlugin, UserConfig} from 'tsdown'
import {afterAll, beforeAll, describe, expect, expectTypeOf, test} from 'vitest'
import {defineConfig, type PackageOptions, type PackagePandaOptions} from '../src/index.ts'

// Written to a temporary directory: the fixture imports the `styled-system` directory that
// `panda codegen` would generate, which the plugin never generates (the builds mark it external)
let fixtureDir: string | undefined

beforeAll(async () => {
  fixtureDir = await mkdtemp(path.join(tmpdir(), 'tsdown-config-panda-'))
  await mkdir(path.join(fixtureDir, 'src'))
  await writeFile(
    path.join(fixtureDir, 'panda.config.ts'),
    `export default {include: ['./src/**/*.ts'], outdir: 'styled-system'}\n`,
  )
  await writeFile(
    path.join(fixtureDir, 'src/index.ts'),
    `import {css} from '../styled-system/css'

export const box = css({paddingInline: '8px', backdropFilter: 'blur(4px)'})
`,
  )
})

afterAll(async () => {
  // `beforeAll` can throw before `mkdtemp` assigns it
  if (fixtureDir) await rm(fixtureDir, {recursive: true, force: true})
})

function getPluginNames(config: UserConfig) {
  const {plugins} = config
  if (!Array.isArray(plugins)) return undefined
  return plugins.map((plugin) =>
    plugin && typeof plugin === 'object' && 'name' in plugin ? plugin.name : undefined,
  )
}

/**
 * Builds the fixture with the Panda plugin exactly as `defineConfig` wired it up (fallback
 * targets included), returning the extracted CSS. Like tsdown, it forwards the resolved
 * top-level `target` through the plugin's `tsdownConfigResolved` hook first.
 */
async function buildCssWithConfig(options: PackageOptions): Promise<string> {
  if (!fixtureDir) expect.unreachable('expected the fixture directory')
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
  await plugin.tsdownConfigResolved?.({cwd: fixtureDir, target} as ResolvedConfig)

  const bundle = await rolldown({
    input: path.join(fixtureDir, 'src/index.ts'),
    external: [/styled-system/],
    plugins: [plugin],
  })
  try {
    const {output} = await bundle.generate({format: 'esm'})
    const asset = output.find((assetOrChunk) => assetOrChunk.fileName === 'styles.css')
    if (!asset || asset.type !== 'asset') expect.unreachable('expected a `styles.css` asset')
    const {source} = asset
    return typeof source === 'string' ? source : new TextDecoder().decode(source)
  } finally {
    await bundle.close()
  }
}

describe('panda option', () => {
  test('`PackagePandaOptions` stays the same type as the plugin options', () => {
    // Defined separately so the declarations don't reference the optional peer
    expectTypeOf<PackagePandaOptions>().toEqualTypeOf<PandaPluginOptions>()
  })

  test('lazily loads the panda plugin when enabled', async () => {
    expect(getPluginNames(await defineConfig())).toEqual([])
    expect(getPluginNames(await defineConfig({panda: true}))).toEqual(['pandacss'])
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
