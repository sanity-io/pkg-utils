import type {NormalizedFormat, Rolldown, UserConfig} from 'tsdown'
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

async function renderChunkFileName(
  config: UserConfig,
  defaultChunkFileNames: string,
  format: NormalizedFormat,
  chunkName: string,
) {
  const {outputOptions} = config
  if (typeof outputOptions !== 'function') throw new Error('expected outputOptions function')

  const resolved = await outputOptions({chunkFileNames: defaultChunkFileNames}, format, {
    cjsDts: false,
  })
  if (!resolved) throw new Error('expected output options')

  const {chunkFileNames} = resolved
  if (typeof chunkFileNames !== 'function') throw new Error('expected chunkFileNames function')

  return chunkFileNames({name: chunkName} as Rolldown.PreRenderedChunk)
}

describe('chunk file names', () => {
  test('emits shared chunks into `_chunks-*` folders, like `@sanity/pkg-utils`', async () => {
    const config = await defineConfig()

    // JS chunks are grouped per output format, reusing the `[name]` template with the output
    // extension that tsdown resolved for the format and package type
    expect(await renderChunkFileName(config, '[name].mjs', 'es', 'theme')).toBe(
      '_chunks-es/[name].mjs',
    )
    expect(await renderChunkFileName(config, '[name].js', 'cjs', 'theme')).toBe(
      '_chunks-cjs/[name].js',
    )

    // `rolldown-plugin-dts` names d.ts chunks with a `.d` suffix and rewrites the rendered JS
    // filename to the matching d.ts extension (e.g. `_chunks-dts/theme.mjs` becomes
    // `_chunks-dts/theme.d.mts`)
    expect(await renderChunkFileName(config, '[name].mjs', 'es', 'theme.d')).toBe(
      '_chunks-dts/[name].mjs',
    )
    expect(await renderChunkFileName(config, '[name].js', 'cjs', 'theme.d')).toBe(
      '_chunks-dts/[name].js',
    )
  })
})
