import path from 'node:path'

import {describe, expect, test} from 'vitest'

import {spawnProject} from './env'

// @TODO make these test suites work on Windows
const isWindows = process.platform === 'win32'

test.skipIf(isWindows)('should build `js` package', async () => {
  const project = await spawnProject('js')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.js → ./dist/index.mjs')
  expect(stdout).toContain('./src/index.js → ./dist/index.js')

  await project.remove()
})

test.skipIf(isWindows)('should build `browser-bundle` package', async () => {
  const project = await spawnProject('browser-bundle')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.js → ./dist/index.js')
  expect(stdout).toContain('./src/index.js → ./dist/index.cjs')

  expect(stdout).toContain('./src/browser.js → ./dist/browser.js')
  expect(stdout).toContain('./src/browser.js → ./dist/browser.cjs')

  expect(await project.readFile('./dist/browser.js')).toMatchSnapshot()
  expect(await project.readFile('./dist/browser.cjs')).toMatchSnapshot()

  await project.remove()
})

test.skipIf(isWindows)('should build `dummy-module` package', async () => {
  const project = await spawnProject('dummy-module')

  await project.install()

  const {stdout} = await project.run('build')

  // types
  expect(stdout).toContain('dummy-module: ./src/index.ts → ./dist/index.d.ts')
  expect(stdout).toContain('dummy-module/extra: ./src/extra.ts → ./dist/extra.d.ts')

  // commonjs
  expect(stdout).toContain('dummy-module: ./src/index.ts → ./dist/index.cjs')
  expect(stdout).toContain('dummy-module: ./src/index.ts → ./dist/index.browser.cjs')
  expect(stdout).toContain('dummy-module/extra: ./src/extra.ts → ./dist/extra.cjs')
  expect(stdout).toContain('dummy-module/extra: ./src/extra.ts → ./dist/extra.browser.cjs')

  // esm
  expect(stdout).toContain('dummy-module: ./src/index.ts → ./dist/index.js')
  expect(stdout).toContain('dummy-module: ./src/index.ts → ./dist/index.browser.js')
  expect(stdout).toContain('dummy-module/extra: ./src/extra.ts → ./dist/extra.js')
  expect(stdout).toContain('dummy-module/extra: ./src/extra.ts → ./dist/extra.browser.js')

  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()
  expect(await project.readFile('dist/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/index.js')).toMatchSnapshot()
  expect(await project.readFile('dist/index.browser.js')).toMatchSnapshot()

  expect(await project.readFile('dist/extra.d.ts')).toMatchSnapshot()
  expect(await project.readFile('dist/extra.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/extra.js')).toMatchSnapshot()
  expect(await project.readFile('dist/extra.browser.js')).toMatchSnapshot()

  await project.remove()
})

test.skipIf(isWindows)('should build `custom-dist` package', async () => {
  const project = await spawnProject('custom-dist')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.ts → ./lib/index.cjs')
  expect(stdout).toContain('./src/index.ts → ./lib/index.js')
  expect(stdout).toContain('./src/index.ts → ./lib/index.d.ts')

  expect(await project.readFile('lib/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('lib/index.js')).toMatchSnapshot()
  expect(await project.readFile('lib/index.d.ts')).toMatchSnapshot()

  await project.remove()
})

test.skipIf(isWindows)('should build `multi-export` package', async () => {
  const project = await spawnProject('multi-export')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.ts → ./dist/index.cjs')
  expect(stdout).toContain('./src/index.ts → ./dist/index.js')
  expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

  expect(stdout).toContain('./src/plugin.ts → ./dist/plugin.cjs')
  expect(stdout).toContain('./src/plugin.ts → ./dist/plugin.js')
  expect(stdout).toContain('./src/plugin.ts → ./dist/plugin.d.ts')

  expect(await project.readFile('dist/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/index.js')).toMatchSnapshot()
  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()

  expect(await project.readFile('dist/plugin.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/plugin.js')).toMatchSnapshot()
  expect(await project.readFile('dist/plugin.d.ts')).toMatchSnapshot()

  await project.remove()
})

test.skipIf(isWindows)('should build `ts` package', async () => {
  const project = await spawnProject('ts')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()

  await project.remove()
})

test.skipIf(isWindows)('should build `ts-node16` package', async () => {
  const project = await spawnProject('ts-node16')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()

  await project.remove()
})

test.skipIf(isWindows)('should build `ts-bundler` package', async () => {
  const project = await spawnProject('ts-bundler')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()

  await project.remove()
})

test.skipIf(isWindows)('should build `react-18` package', async () => {
  const project = await spawnProject('react-18')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')
  expect(stdout).toContain('./src/index.ts → ./dist/index.js')

  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()
  expect(await project.readFile('dist/index.js')).toMatchSnapshot()

  await project.remove()
})

test.skipIf(isWindows)('should build `react-19` package', async () => {
  const project = await spawnProject('react-19')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')
  expect(stdout).toContain('./src/index.ts → ./dist/index.js')

  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()
  expect(await project.readFile('dist/index.js')).toMatchSnapshot()

  await project.remove()
})

test.skipIf(isWindows)('should build `css-export` package', async () => {
  const project = await spawnProject('css-export')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('./src/index.js → ./dist/index.js')
  // @TODO test that styles.css is available as an export from the package

  await project.remove()
})

describe.skip('runtime: next.js', () => {
  test('import `dist/*.browser.js` from package', async () => {
    const exportsDummy = await spawnProject('dummy-module')
    const runtime = await spawnProject('runtime-next-js')

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

    await runtime.remove()
    await exportsDummy.remove()
  })
})
