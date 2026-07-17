import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/react-19-library')

function getPluginNames(config: UserConfig) {
  const {plugins} = config
  if (!Array.isArray(plugins)) return undefined
  return plugins.map((plugin) =>
    plugin && typeof plugin === 'object' && 'name' in plugin ? plugin.name : undefined,
  )
}

describe('reactCompiler option', () => {
  test('is disabled by default', async () => {
    expect(getPluginNames(await defineConfig())).toEqual([])
    expect(getPluginNames(await defineConfig({reactCompiler: false}))).toEqual([])
  })

  test('adds the babel plugin when enabled', async () => {
    expect(getPluginNames(await defineConfig({reactCompiler: true}))).toEqual([
      '@rolldown/plugin-babel',
    ])
    expect(getPluginNames(await defineConfig({reactCompiler: {target: '19'}}))).toEqual([
      '@rolldown/plugin-babel',
    ])
  })
})

describe('reactCompilerSurfaces option', () => {
  test('is disabled by default', async () => {
    expect(getPluginNames(await defineConfig({reactCompiler: true}))).toEqual([
      '@rolldown/plugin-babel',
    ])
  })

  test('adds the surfaces plugin before the React Compiler babel plugin', async () => {
    expect(
      getPluginNames(await defineConfig({reactCompiler: true, reactCompilerSurfaces: true})),
    ).toEqual(['sanity-react-compiler-surfaces', '@rolldown/plugin-babel'])
    expect(
      getPluginNames(
        await defineConfig({reactCompiler: {target: '19'}, reactCompilerSurfaces: {}}),
      ),
    ).toEqual(['sanity-react-compiler-surfaces', '@rolldown/plugin-babel'])
  })
})

describe('react-19-library', () => {
  test('applies the React Compiler to esm and cjs output', async () => {
    const [distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])

    // The React Compiler memoizes components with a memo cache provided by
    // `react/compiler-runtime` (since the fixture sets `reactCompiler: {target: '19'}`)
    expect(distIndexJs).toContain('import { c } from "react/compiler-runtime"')
    expect(distIndexJs).toContain('$ = c(')
    expect(distIndexJs).toContain('react.memo_cache_sentinel')

    expect(distIndexCjs).toContain('require("react/compiler-runtime")')
    expect(distIndexCjs).toContain('react.memo_cache_sentinel')
  })

  test('memoizes annotated surface components with `reactCompilerSurfaces`', async () => {
    const [distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])

    for (const output of [distIndexJs, distIndexCjs]) {
      // The `marks.link` component in `portableText.tsx` is an object-property function the
      // compiler's `infer` mode never compiles on its own: the surfaces plugin injected the
      // `'use memo'` opt-in (still visible in the output), and the compiler memoized it in
      // place with a cache keyed on its props (`rel` is derived state unique to that component)
      expect(output).toContain('use memo')
      expect(output).toMatch(/\$\[\d\] !== rel/)
    }
  })

  test('replaces `define` globals at build time', async () => {
    const [distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])

    // The fixture sets `define: {'process.env.NODE_ENV': JSON.stringify('production')}`, so the
    // `process.env.NODE_ENV === 'development'` branch is evaluated and eliminated at build time
    for (const output of [distIndexJs, distIndexCjs]) {
      expect(output).not.toContain('process.env.NODE_ENV')
      expect(output).not.toContain('Foo')
    }
  })
})
