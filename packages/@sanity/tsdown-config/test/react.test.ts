import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/react-19-library')

async function getPluginNames(config: UserConfig) {
  const {plugins} = config
  if (!Array.isArray(plugins)) return undefined
  // The babel plugin is lazy loaded, so entries can be promises that tsdown awaits
  return Promise.all(
    plugins.map(async (plugin) => {
      const resolved = await plugin
      return resolved && typeof resolved === 'object' && 'name' in resolved
        ? resolved.name
        : undefined
    }),
  )
}

describe('reactCompiler option', () => {
  test('is disabled by default', async () => {
    expect(await getPluginNames(defineConfig())).toBeUndefined()
    expect(await getPluginNames(defineConfig({reactCompiler: false}))).toBeUndefined()
  })

  test('adds the babel plugin when enabled', async () => {
    expect(await getPluginNames(defineConfig({reactCompiler: true}))).toEqual(['babel'])
    expect(await getPluginNames(defineConfig({reactCompiler: {target: '19'}}))).toEqual(['babel'])
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
})
