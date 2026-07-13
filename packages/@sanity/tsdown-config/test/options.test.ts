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

describe('chunk file names', () => {
  test('relies on tsdown defaults, so shared chunks get hashed filenames', async () => {
    const config = await defineConfig()

    // `hash` stays at tsdown's default (`true`), which renders chunks as `[name]-[hash].<ext>`:
    // the hash suffix keeps a chunk from ever taking an entry's filename, which could otherwise
    // hand an entry's d.ts filename to a chunk that re-exports everything under minified aliases
    // (https://github.com/sanity-io/ui/issues/2262)
    expect(config.hash).toBeUndefined()
    expect(config.outputOptions).toEqual({hoistTransitiveImports: false})
  })
})
