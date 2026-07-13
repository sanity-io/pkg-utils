import {readdir, readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/multi-entry-library')

describe('multi-entry-library', () => {
  test('shared chunks carry a content hash, so they never take an entry filename', async () => {
    const files = (await readdir(path.join(fixtureDir, 'dist'))).filter(
      (file) => !file.endsWith('.map'),
    )

    // Entries keep their stable, unhashed filenames
    expect(files).toEqual(
      expect.arrayContaining([
        'index.cjs',
        'index.d.cts',
        'index.d.ts',
        'index.js',
        'theme.cjs',
        'theme.d.cts',
        'theme.d.ts',
        'theme.js',
      ]),
    )

    // The code shared between the `index` and `theme` entries forms a chunk that rolldown also
    // names `theme`: tsdown's default `-[hash]` suffix keeps it from colliding with the entry
    expect(files).toContainEqual(expect.stringMatching(/^theme-[\w-]+\.js$/))
    expect(files).toContainEqual(expect.stringMatching(/^theme-[\w-]+\.cjs$/))
    expect(files).toContainEqual(expect.stringMatching(/^theme-[\w-]+\.d\.ts$/))
    expect(files).toContainEqual(expect.stringMatching(/^theme-[\w-]+\.d\.cts$/))

    // Without the hash, the JS output would dedupe the collision by renaming the chunk `theme2`
    // and the d.ts output could hand `theme.d.ts` to the chunk instead of the entry
    expect(files).not.toContainEqual(expect.stringMatching(/^theme2/))
  })

  test('entries reference the hashed shared chunk', async () => {
    const [distIndexJs, distThemeJs, distThemeCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/theme.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/theme.cjs'), 'utf-8'),
    ])

    expect(distIndexJs).toMatch(/from "\.\/theme-[\w-]+\.js"/)
    expect(distThemeJs).toMatch(/from "\.\/theme-[\w-]+\.js"/)
    expect(distThemeCjs).toMatch(/require\("\.\/theme-[\w-]+\.cjs"\)/)
  })

  test('entry d.ts files keep their named exports (sanity-io/ui#2262)', async () => {
    const [distThemeDts, distThemeDcts] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/theme.d.ts'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/theme.d.cts'), 'utf-8'),
    ])

    // Without hashed chunk filenames the shared chunk - which exports everything under minified
    // aliases like `buildTheme as n` - could win the `theme.d.ts` filename over the `theme` entry,
    // breaking every named import from the entry with TS2460
    expect(distThemeDts).toMatch(/from "\.\/theme-[\w-]+\.js"/)
    expect(distThemeDts).toContain('export { ThemeConfig, buildTheme }')
    expect(distThemeDts).not.toContain('buildTheme as')

    expect(distThemeDcts).toMatch(/from "\.\/theme-[\w-]+\.cjs"/)
    expect(distThemeDcts).toContain('export { ThemeConfig, buildTheme }')
    expect(distThemeDcts).not.toContain('buildTheme as')
  })

  test('the built entries resolve their chunks at runtime', async () => {
    const themeEsm = await import(pathToFileURL(path.join(fixtureDir, 'dist/theme.js')).href)
    expect(themeEsm.buildTheme({scheme: 'dark'})).toEqual({scheme: 'dark'})

    const require = createRequire(import.meta.url)
    const themeCjs = require(path.join(fixtureDir, 'dist/theme.cjs'))
    expect(themeCjs.buildTheme({})).toEqual({scheme: 'light'})
  })
})
