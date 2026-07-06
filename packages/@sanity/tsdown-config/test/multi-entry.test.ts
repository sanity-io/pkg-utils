import {readdir, readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/multi-entry-library')

describe('multi-entry-library', () => {
  test('emits shared chunks into `_chunks-*` folders, like `@sanity/pkg-utils`', async () => {
    const topLevel = await readdir(path.join(fixtureDir, 'dist'))

    // Only entry files (and the chunk folders) live at the root of `dist`, so a shared chunk can
    // never take an entry's filename
    expect(topLevel.filter((file) => !file.endsWith('.map')).toSorted()).toEqual([
      '_chunks-cjs',
      '_chunks-dts',
      '_chunks-es',
      'index.cjs',
      'index.d.cts',
      'index.d.ts',
      'index.js',
      'theme.cjs',
      'theme.d.cts',
      'theme.d.ts',
      'theme.js',
    ])

    // The code shared between the `index` and `theme` entries forms a chunk that rolldown also
    // names `theme`, which lands in the format-specific chunk folders
    const [esChunks, cjsChunks, dtsChunks] = await Promise.all([
      readdir(path.join(fixtureDir, 'dist/_chunks-es')),
      readdir(path.join(fixtureDir, 'dist/_chunks-cjs')),
      readdir(path.join(fixtureDir, 'dist/_chunks-dts')),
    ])
    expect(esChunks).toContain('theme.js')
    expect(cjsChunks).toContain('theme.cjs')
    expect(dtsChunks).toContain('theme.d.ts')
    expect(dtsChunks).toContain('theme.d.cts')
  })

  test('entries reference the shared chunk in the chunk folders', async () => {
    const [distIndexJs, distThemeJs, distThemeCjs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/theme.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/theme.cjs'), 'utf-8'),
    ])

    expect(distIndexJs).toContain('from "./_chunks-es/theme.js"')
    expect(distThemeJs).toContain('from "./_chunks-es/theme.js"')
    expect(distThemeCjs).toContain('require("./_chunks-cjs/theme.cjs")')
  })

  test('entry d.ts files keep their named exports (sanity-io/ui#2262)', async () => {
    const [distThemeDts, distThemeDcts] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/theme.d.ts'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/theme.d.cts'), 'utf-8'),
    ])

    // Without the `_chunks-*` folders the shared chunk - which exports everything under minified
    // aliases like `buildTheme as n` - could win the `theme.d.ts` filename over the `theme` entry,
    // breaking every named import from the entry with TS2460
    expect(distThemeDts).toContain('from "./_chunks-dts/theme.js"')
    expect(distThemeDts).toContain('export { ThemeConfig, buildTheme }')
    expect(distThemeDts).not.toContain('buildTheme as')

    expect(distThemeDcts).toContain('from "./_chunks-dts/theme.cjs"')
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
