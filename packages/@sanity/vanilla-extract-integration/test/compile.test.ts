import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, test} from 'vitest'
import {compile} from '../src/compile.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(__dirname, '..')
const fixtureDir = path.join(__dirname, 'fixtures/basic')
const entryPath = path.join(fixtureDir, 'entry.css.ts')

describe('compile', () => {
  test('bundles the .css.ts graph into CommonJS with file scopes and external @vanilla-extract', async () => {
    const {source, watchFiles} = await compile({
      filePath: entryPath,
      cwd: packageRoot,
      identOption: 'short',
    })

    // Every vanilla-extract module in the graph is wrapped with its file scope
    expect(source).toContain('"test/fixtures/basic/entry.css.ts"')
    expect(source).toContain('"test/fixtures/basic/theme.css.ts"')
    expect(source).toContain('"@sanity/vanilla-extract-integration"')

    // The plain util module is bundled in (its value is inlined or referenced)
    expect(source).toContain('8px')

    // @vanilla-extract packages stay external, as CJS requires the eval sandbox resolves
    expect(source).toMatch(/require\(["']@vanilla-extract\/css["']\)/)
    expect(source).toMatch(/require\(["']@vanilla-extract\/css\/fileScope["']\)/)

    // The whole local graph is reported for watching
    expect(watchFiles).toEqual(
      expect.arrayContaining([
        entryPath,
        path.join(fixtureDir, 'theme.css.ts'),
        path.join(fixtureDir, 'util.ts'),
      ]),
    )
  })

  test('injects debug IDs into every module of the graph with identOption debug', async () => {
    const {source} = await compile({
      filePath: entryPath,
      cwd: packageRoot,
      identOption: 'debug',
    })

    expect(source).toContain('"box"')
    expect(source).toContain('"themeClass"')
  })
})
