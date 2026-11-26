import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {afterEach, describe, expect, test} from 'vitest'
import {collectSideEffects, writePackageSideEffects} from '../src/sideEffects.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cssModulesFixture = path.resolve(__dirname, 'fixtures/css-modules-library')
const react19Fixture = path.resolve(__dirname, 'fixtures/react-19-library')
const pandaFixture = path.resolve(__dirname, 'fixtures/panda-library')

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, {recursive: true, force: true})))
})

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tsdown-config-side-effects-'))
  tempDirs.push(dir)
  return dir
}

describe('collectSideEffects', () => {
  test('lists CSS assets and JS files that import them after a CSS modules build', () => {
    expect(
      collectSideEffects({
        cwd: cssModulesFixture,
        outDir: 'dist',
      }),
    ).toEqual(['./dist/index.js', './dist/style.css'])
  })

  test('lists CSS and both dual-format entries after a panda build', () => {
    expect(
      collectSideEffects({
        cwd: pandaFixture,
        outDir: 'dist',
      }),
    ).toEqual(['./dist/bundle.css', './dist/index.cjs', './dist/index.js'])
  })

  test('returns false when the build produced no side-effectful files', () => {
    expect(
      collectSideEffects({
        cwd: react19Fixture,
        outDir: 'dist',
      }),
    ).toBe(false)
  })

  test('treats vanilla-extract-style .css.js chunks as side-effectful, not *-css.js shims', async () => {
    const cwd = await tempDir()
    const dist = path.join(cwd, 'dist')
    await mkdir(dist, {recursive: true})
    await Promise.all([
      writeFile(path.join(dist, 'button.css.js'), 'injectStyles()', 'utf8'),
      writeFile(path.join(dist, 'style-css.js'), '// no-op shim\n', 'utf8'),
      writeFile(path.join(dist, 'style.css'), '.x{}', 'utf8'),
      writeFile(path.join(dist, 'index.js'), 'export const x = 1\n', 'utf8'),
    ])

    expect(collectSideEffects({cwd, outDir: 'dist'})).toEqual([
      './dist/button.css.js',
      './dist/style.css',
    ])
  })

  test('detects minified ESM CSS imports and compressed CJS requires', async () => {
    const cwd = await tempDir()
    const dist = path.join(cwd, 'dist')
    await mkdir(dist, {recursive: true})
    await Promise.all([
      writeFile(
        path.join(dist, 'index.js'),
        // Full minify may drop the space after `import`
        'import"example/style.css";export const x = 1;\n',
        'utf8',
      ),
      writeFile(
        path.join(dist, 'index.cjs'),
        'require("example/style.css"), Object.defineProperty(exports, "x", {value: 1});\n',
        'utf8',
      ),
      writeFile(path.join(dist, 'style.css'), '.x{}', 'utf8'),
    ])

    expect(collectSideEffects({cwd, outDir: 'dist'})).toEqual([
      './dist/index.cjs',
      './dist/index.js',
      './dist/style.css',
    ])
  })

  test('ignores CSS import mention inside JSDoc', async () => {
    const cwd = await tempDir()
    const dist = path.join(cwd, 'dist')
    await mkdir(dist, {recursive: true})
    await writeFile(
      path.join(dist, 'plugin.js'),
      '/**\n * prepends `import "./style.css"` to entry chunks\n */\nexport const x = 1\n',
      'utf8',
    )

    expect(collectSideEffects({cwd, outDir: 'dist'})).toBe(false)
  })
})

describe('writePackageSideEffects', () => {
  test('rewrites sideEffects and preserves indentation', async () => {
    const cwd = await tempDir()
    const packageJsonPath = path.join(cwd, 'package.json')
    await writeFile(packageJsonPath, '{\n  "name": "example",\n  "sideEffects": true\n}\n', 'utf8')

    expect(
      writePackageSideEffects({
        packageJsonPath,
        sideEffects: ['./dist/index.js', './dist/style.css'],
      }),
    ).toBe(true)

    expect(await readFile(packageJsonPath, 'utf8')).toBe(
      '{\n  "name": "example",\n  "sideEffects": [\n    "./dist/index.js",\n    "./dist/style.css"\n  ]\n}\n',
    )
  })

  test('is a no-op when the value already matches', async () => {
    const cwd = await tempDir()
    const packageJsonPath = path.join(cwd, 'package.json')
    const original = '{\n  "name": "example",\n  "sideEffects": false\n}\n'
    await writeFile(packageJsonPath, original, 'utf8')

    expect(writePackageSideEffects({packageJsonPath, sideEffects: false})).toBe(false)
    expect(await readFile(packageJsonPath, 'utf8')).toBe(original)
  })
})

describe('sideEffects after fixture builds', () => {
  test('css-modules-library package.json lists exact CSS and entry paths', async () => {
    const pkg = JSON.parse(await readFile(path.join(cssModulesFixture, 'package.json'), 'utf8'))
    expect(pkg.sideEffects).toEqual(['./dist/index.js', './dist/style.css'])
  })

  test('react-19-library package.json is sideEffects: false', async () => {
    const pkg = JSON.parse(await readFile(path.join(react19Fixture, 'package.json'), 'utf8'))
    expect(pkg.sideEffects).toBe(false)
  })

  test('panda-library package.json lists CSS and both format entries', async () => {
    const pkg = JSON.parse(await readFile(path.join(pandaFixture, 'package.json'), 'utf8'))
    expect(pkg.sideEffects).toEqual(['./dist/bundle.css', './dist/index.cjs', './dist/index.js'])
  })
})
