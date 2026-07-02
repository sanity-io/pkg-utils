import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/react-19-library')

describe('react-19-library', () => {
  test('applies the React Compiler when `babel.reactCompiler` is enabled', async () => {
    const [distIndexJs, distIndexCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.cjs'), 'utf-8'),
    ])

    // The React Compiler memoizes components with a memo cache provided by
    // `react/compiler-runtime` (since the fixture sets `reactCompilerOptions: {target: '19'}`)
    expect(distIndexJs).toContain('import { c } from "react/compiler-runtime"')
    expect(distIndexJs).toContain('$ = c(')
    expect(distIndexJs).toContain('react.memo_cache_sentinel')

    expect(distIndexCjs).toContain('require("react/compiler-runtime")')
    expect(distIndexCjs).toContain('react.memo_cache_sentinel')
  })
})
