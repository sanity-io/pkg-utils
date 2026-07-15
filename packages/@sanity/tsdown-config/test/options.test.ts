import {describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

describe('dts option', () => {
  test('is undefined by default, so tsdown auto-detects it from package.json', async () => {
    expect((await defineConfig()).dts).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    expect((await defineConfig({dts: false})).dts).toBe(false)
    expect((await defineConfig({dts: true})).dts).toBe(true)
    expect((await defineConfig({dts: {tsgo: true}})).dts).toEqual({tsgo: true})
    expect((await defineConfig({dts: {sourcemap: true, oxc: false}})).dts).toEqual({
      sourcemap: true,
      oxc: false,
    })
  })
})

describe('define option', () => {
  test('is undefined by default', async () => {
    expect((await defineConfig()).define).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    const define = {'process.env.NODE_ENV': JSON.stringify('production')}
    expect((await defineConfig({define})).define).toEqual(define)
  })
})

describe('target option', () => {
  test('is undefined by default, so tsdown applies no syntax downleveling', async () => {
    expect((await defineConfig()).target).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    // tsdown resolves the target into `ResolvedConfig.target`, where plugins pick it up - e.g.
    // `@sanity/vanilla-extract-tsdown-plugin` uses it as the default CSS syntax lowering target
    expect((await defineConfig({target: 'chrome90'})).target).toBe('chrome90')
    expect((await defineConfig({target: ['chrome90', 'safari16']})).target).toEqual([
      'chrome90',
      'safari16',
    ])
  })
})

describe('tsconfig option', () => {
  test('is undefined by default, so tsdown auto-detects it from the project', async () => {
    expect((await defineConfig()).tsconfig).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    expect((await defineConfig({tsconfig: 'tsconfig.dist.json'})).tsconfig).toBe(
      'tsconfig.dist.json',
    )
  })
})

describe('sourcemap option', () => {
  test('defaults to true, matching @sanity/pkg-utils', async () => {
    // tsdown itself defaults to false and does not read `sourceMap` from the tsconfig
    expect((await defineConfig()).sourcemap).toBe(true)
  })

  test('is passed through to tsdown as-is', async () => {
    expect((await defineConfig({sourcemap: false})).sourcemap).toBe(false)
    expect((await defineConfig({sourcemap: 'inline'})).sourcemap).toBe('inline')
  })
})

describe('deps option', () => {
  test('defaults to neverBundle `/^node:/` when platform is neutral', async () => {
    expect((await defineConfig()).deps).toEqual({neverBundle: [/^node:/]})
    expect((await defineConfig({platform: 'neutral'})).deps).toEqual({neverBundle: [/^node:/]})
  })

  test('does not add `/^node:/` when platform is not neutral', async () => {
    expect((await defineConfig({platform: 'node'})).deps).toBeUndefined()
    expect(
      (await defineConfig({platform: 'node', deps: {skipNodeModulesBundle: true}})).deps,
    ).toEqual({skipNodeModulesBundle: true})
  })

  test('appends userland neverBundle entries to the `/^node:/` default', async () => {
    // tsdown's `mergeConfig` would replace the array; concatenate so per-package externals
    // (e.g. self-references like `/^sanity(\\/|$)/`) add to the node builtins instead
    expect(
      (await defineConfig({deps: {neverBundle: [/^sanity(\/|$)/]}})).deps,
    ).toEqual({neverBundle: [/^node:/, /^sanity(\/|$)/]})
    expect(
      (
        await defineConfig({
          deps: {neverBundle: [/^sanity(\/|$)/], skipNodeModulesBundle: true},
        })
      ).deps,
    ).toEqual({
      neverBundle: [/^node:/, /^sanity(\/|$)/],
      skipNodeModulesBundle: true,
    })
  })

  test('composes a userland neverBundle function with the `/^node:/` default', async () => {
    // Rolldown's ExternalOption array form is string|RegExp only, so a function override is
    // OR'd with the node builtin check instead of being pushed into an array
    const neverBundle = (
      await defineConfig({
        deps: {
          neverBundle: (id) => id === 'sanity/_singletons' || id.startsWith('sanity/'),
        },
      })
    ).deps?.neverBundle
    expect(typeof neverBundle).toBe('function')
    if (typeof neverBundle !== 'function') throw new Error('expected a function')

    expect(neverBundle('node:fs', undefined, false)).toBe(true)
    expect(neverBundle('sanity/_singletons', undefined, false)).toBe(true)
    expect(neverBundle('lodash', undefined, false)).toBe(false)
  })
})

describe('neutral platform resolution', () => {
  test('restores module/main mainFields for inlined deps without an exports map', async () => {
    const {inputOptions} = await defineConfig()
    expect(inputOptions && typeof inputOptions !== 'function' && inputOptions.resolve).toEqual({
      mainFields: ['module', 'main'],
    })
  })

  test('leaves mainFields alone when platform is not neutral', async () => {
    const {inputOptions} = await defineConfig({platform: 'node'})
    expect(
      inputOptions && typeof inputOptions !== 'function' ? inputOptions.resolve : undefined,
    ).toBeUndefined()
  })
})

describe('unexposed options', () => {
  test('lean on tsdown defaults, customizable in userland through `mergeConfig`', async () => {
    // Options not in `PackageOptions` (e.g. `hash`, with its collision-preventing hashed chunk
    // filenames - https://github.com/sanity-io/ui/issues/2262 - or `outputOptions`) are left to
    // tsdown's defaults; userland can still change them by merging over the returned config
    // with tsdown's `mergeConfig`
    const config = await defineConfig()
    expect(config).not.toHaveProperty('hash')
    expect(config.outputOptions).toBeUndefined()
  })
})

describe('exports option', () => {
  test('defaults to local-only generation with dev exports', async () => {
    // `enabled: 'local-only'` generates the `exports` map during local builds and skips it in
    // CI; `devExports: true` keeps the local `exports` map pointing at source files while
    // `publishConfig.exports` receives the built files
    expect((await defineConfig()).exports).toEqual({enabled: 'local-only', devExports: true})
  })

  test('merges an object over the defaults', async () => {
    expect((await defineConfig({exports: {all: true}})).exports).toEqual({
      enabled: 'local-only',
      devExports: true,
      all: true,
    })
    expect((await defineConfig({exports: {devExports: 'source'}})).exports).toEqual({
      enabled: 'local-only',
      devExports: 'source',
    })
  })

  test('non-object values replace the defaults, like `mergeConfig`', async () => {
    // A bare CI condition passes through as-is (dropping the defaults - set
    // `exports: {enabled: 'ci-only'}` to merge instead), and `false` disables the feature
    expect((await defineConfig({exports: 'ci-only'})).exports).toBe('ci-only')
    expect((await defineConfig({exports: {enabled: 'ci-only'}})).exports).toEqual({
      enabled: 'ci-only',
      devExports: true,
    })
    expect((await defineConfig({exports: false})).exports).toBe(false)
  })
})
