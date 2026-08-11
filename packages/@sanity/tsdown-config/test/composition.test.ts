import {mergeConfig, type Rolldown} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

/**
 * The composition contract for programmatic hosts (e.g. `@sanity/pkg-utils`):
 * `defineConfig()` output is a `mergeConfig`-safe base. `mergeConfig` appends `plugins`
 * (top-level, `inputOptions`, `outputOptions`), deep-merges plain objects, and replaces
 * everything else (scalars and non-plugin arrays) — so a host can layer its own opinions
 * over the returned config without clobbering the plugins or defaults this config sets up.
 */
describe('programmatic composition via mergeConfig', () => {
  const marker: Rolldown.Plugin = {name: 'composition-marker'}

  test('appends plugins instead of replacing the ones this config sets up', async () => {
    const base = await defineConfig({vanillaExtract: true})
    const composed = mergeConfig(base, {plugins: [marker]})

    const pluginNames = (composed.plugins as Rolldown.Plugin[]).map(
      (plugin) => plugin && typeof plugin === 'object' && 'name' in plugin && plugin.name,
    )
    // The vanilla-extract plugin from the base config survives, the host plugin is appended
    expect(pluginNames).toEqual(['vanilla-extract', 'composition-marker'])
  })

  test('appends plugins even when the base config added none', async () => {
    const composed = mergeConfig(await defineConfig(), {plugins: [marker]})
    expect(composed.plugins).toEqual([marker])
  })

  test('keeps TSDoc repair when a host adds an input plugin', async () => {
    const composed = mergeConfig(await defineConfig({dts: true, tsdoc: true}), {
      inputOptions: {plugins: [marker]},
    })
    const {inputOptions} = composed
    if (!inputOptions || typeof inputOptions === 'function') throw new Error('expected an object')
    expect(inputOptions.plugins).toEqual([
      expect.objectContaining({name: 'sanity-namespace-release-tags'}),
      marker,
    ])
  })

  test('deep-merges plain objects over the defaults', async () => {
    const composed = mergeConfig(await defineConfig(), {minify: {mangle: true}})
    expect(composed.minify).toEqual({
      compress: {keepNames: {function: true, class: true}},
      codegen: false,
      mangle: true,
    })

    const withResolve = mergeConfig(await defineConfig(), {
      inputOptions: {resolve: {alias: {'~': './src'}}},
    })
    const {inputOptions} = withResolve
    if (!inputOptions || typeof inputOptions === 'function') throw new Error('expected an object')
    // The neutral-platform mainFields default survives next to the host's alias
    expect(inputOptions.resolve).toEqual({
      mainFields: ['module', 'main'],
      alias: {'~': './src'},
    })
    expect(inputOptions.preserveEntrySignatures).toBe('strict')
  })

  test('replaces scalars and non-plugin arrays', async () => {
    const base = await defineConfig({format: ['esm', 'cjs']})
    const composed = mergeConfig(base, {format: ['esm'], publint: false, sourcemap: false})
    expect(composed.format).toEqual(['esm'])
    expect(composed.publint).toBe(false)
    expect(composed.sourcemap).toBe(false)
    // Untouched defaults survive the merge
    expect(composed.checks).toEqual({circularDependency: true})
  })

  test('replaces the suppressWarnings predicate, the escape hatch for its default', async () => {
    // Functions don't merge, so merging `suppressWarnings` over the base config is how a host
    // opts out of the built-in declaration-only cycle suppression (adding to it goes through
    // the `suppressWarnings` option instead)
    const dtsCycle = 'Circular dependency: src/index.d.ts -> src/nodes.d.ts -> src/index.d.ts.'
    const base = await defineConfig()
    if (typeof base.suppressWarnings !== 'function') throw new Error('expected a predicate')
    expect(base.suppressWarnings(dtsCycle)).toBe(true)

    const composed = mergeConfig(base, {suppressWarnings: () => false})
    if (typeof composed.suppressWarnings !== 'function') throw new Error('expected a predicate')
    expect(composed.suppressWarnings(dtsCycle)).toBe(false)
  })
})

describe('cwd option', () => {
  test('is undefined by default, so tsdown resolves from process.cwd()', async () => {
    expect((await defineConfig()).cwd).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    expect((await defineConfig({cwd: '/somewhere/else'})).cwd).toBe('/somewhere/else')
  })
})
