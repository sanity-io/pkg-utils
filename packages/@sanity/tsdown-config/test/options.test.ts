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

  test('accepts a CI condition for `enabled`', async () => {
    expect((await defineConfig({exports: 'ci-only'})).exports).toEqual({
      enabled: 'ci-only',
      devExports: true,
    })
  })

  test('can be disabled entirely', async () => {
    expect((await defineConfig({exports: false})).exports).toBe(false)
  })
})
