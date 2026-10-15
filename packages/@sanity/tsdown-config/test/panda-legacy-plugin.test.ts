import {expect, test, vi} from 'vitest'
import {defineConfig} from '../src/index.ts'

// A consumer whose installed `@sanity/pandacss-tsdown-plugin` predates `cascadeLayers`: a 0.1
// release, which doesn't export the option names (that started in 0.2.0) and ignores the options
// it doesn't have
vi.mock('@sanity/pandacss-tsdown-plugin', async (importOriginal) => {
  const {pandacssPlugin} = await importOriginal<typeof import('@sanity/pandacss-tsdown-plugin')>()
  // Spelled out, because vitest's mock throws for an export it wasn't given at all
  return {pandacssPlugin, PANDACSS_PLUGIN_OPTION_NAMES: undefined}
})

test('`panda.cascadeLayers` reports a plugin that predates it, which would ignore it', async () => {
  // The peer range accepts every version of the plugin, so upgrading only this package lets
  // `cascadeLayers: false` type-check against a plugin that keeps the layers
  await expect(defineConfig({panda: {cascadeLayers: false}})).rejects.toThrow(
    '`panda.cascadeLayers` needs a newer `@sanity/pandacss-tsdown-plugin`: the installed version has no `cascadeLayers` option, and would ignore it.',
  )
  // The options that plugin has still work, and an option set to `undefined` is left out
  await expect(
    defineConfig({panda: {minify: true, cascadeLayers: undefined}}),
  ).resolves.toMatchObject({
    plugins: expect.arrayContaining([expect.objectContaining({name: 'pandacss'})]),
  })
})
