import path from 'path'
import {describe, expect, test} from 'vitest'
import {_spawnProject} from './env'

test('should build `js` package', async () => {
  const project = await _spawnProject('js')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.js -> ./dist/index.mjs')
  expect(stdout).toContain('./src/index.js -> ./dist/index.js')

  await project.remove()
})

test('should build `exports-dummy` package', async () => {
  const project = await _spawnProject('exports-dummy')

  await project.install()

  const {stdout} = await project.run('build')

  // types
  expect(stdout).toContain('exports-dummy: ./src/index.ts -> ./dist/src/index.d.ts')
  expect(stdout).toContain('exports-dummy/extra: ./src/extra.ts -> ./dist/src/extra.d.ts')

  // commonjs
  expect(stdout).toContain('exports-dummy: ./src/index.ts -> ./dist/index.cjs')
  expect(stdout).toContain('exports-dummy: ./src/index.ts -> ./dist/index.browser.cjs')
  expect(stdout).toContain('exports-dummy/extra: ./src/extra.ts -> ./dist/extra.cjs')
  expect(stdout).toContain('exports-dummy/extra: ./src/extra.ts -> ./dist/extra.browser.cjs')

  // esm
  expect(stdout).toContain('exports-dummy: ./src/index.ts -> ./dist/index.js')
  expect(stdout).toContain('exports-dummy: ./src/index.ts -> ./dist/index.browser.js')
  expect(stdout).toContain('exports-dummy/extra: ./src/extra.ts -> ./dist/extra.js')
  expect(stdout).toContain('exports-dummy/extra: ./src/extra.ts -> ./dist/extra.browser.js')

  expect(await project.readFile('dist/src/index.d.ts')).toMatchSnapshot()
  expect(await project.readFile('dist/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/index.js')).toMatchSnapshot()
  expect(await project.readFile('dist/index.browser.js')).toMatchSnapshot()

  expect(await project.readFile('dist/src/extra.d.ts')).toMatchSnapshot()
  expect(await project.readFile('dist/extra.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/extra.js')).toMatchSnapshot()
  expect(await project.readFile('dist/extra.browser.js')).toMatchSnapshot()

  await project.remove()
})

test('should build `custom-dist` package', async () => {
  const project = await _spawnProject('custom-dist')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.ts -> ./lib/index.cjs')
  expect(stdout).toContain('./src/index.ts -> ./lib/index.js')
  expect(stdout).toContain('./src/index.ts -> ./lib/src/index.d.ts')

  expect(await project.readFile('lib/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('lib/index.js')).toMatchSnapshot()
  expect(await project.readFile('lib/src/index.d.ts')).toMatchSnapshot()

  await project.remove()
})

test('should build `multi-export` package', async () => {
  const project = await _spawnProject('multi-export')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.ts -> ./dist/index.cjs')
  expect(stdout).toContain('./src/index.ts -> ./dist/index.js')
  expect(stdout).toContain('./src/index.ts -> ./dist/src/index.d.ts')

  expect(stdout).toContain('./src/plugin.ts -> ./dist/plugin.cjs')
  expect(stdout).toContain('./src/plugin.ts -> ./dist/plugin.js')
  expect(stdout).toContain('./src/plugin.ts -> ./dist/src/plugin.d.ts')

  expect(await project.readFile('dist/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/index.js')).toMatchSnapshot()
  expect(await project.readFile('dist/src/index.d.ts')).toMatchSnapshot()

  expect(await project.readFile('dist/plugin.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/plugin.js')).toMatchSnapshot()
  expect(await project.readFile('dist/src/plugin.d.ts')).toMatchSnapshot()

  await project.remove()
})

describe('runtime: webpack v3', () => {
  test('import `dist/*.browser.js` from package', async () => {
    const exportsDummy = await _spawnProject('exports-dummy')
    const runtime = await _spawnProject('runtime-webpack-v3')

    // install and build dummy package
    await exportsDummy.install()
    await exportsDummy.run('build')

    await runtime.install()

    // build (uses webpack v3)
    await runtime.run('build')

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {index, extra} = runtime.require('dist/main.js')

    expect(index.runtime).toBe('browser')
    expect(index.format).toBe('esm')
    expect(index.path).toBe('dist/index.browser.js')

    expect(extra.runtime).toBe('browser')
    expect(extra.format).toBe('esm')
    expect(extra.path).toBe('dist/extra.browser.js')
  })
})

describe('runtime: next.js', () => {
  test('import `dist/*.browser.js` from package', async () => {
    const exportsDummy = await _spawnProject('exports-dummy')
    const runtime = await _spawnProject('runtime-next-js')

    // install and build dummy package
    await exportsDummy.install()
    await exportsDummy.run('build')

    await runtime.install()

    // build (uses `next build`)
    await runtime.run('build')

    const buildManifest = runtime.require('.next/build-manifest.json')

    const pageScriptPath = buildManifest.pages['/'].find((f: string) => f.includes('pages/index'))

    const pageFile = await runtime.readFile(path.join('.next', pageScriptPath))

    expect(pageFile).toContain(`"dist/index.browser.js"`)
    expect(pageFile).toContain(`"dist/extra.browser.js"`)
  })
})
