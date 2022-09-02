import path from 'path'
import {describe, expect, test} from 'vitest'
import {_spawnProject} from './env'

const __ROOT__ = path.resolve(__dirname, '..')

test('should build `custom-dist` package', async () => {
  const project = await _spawnProject('custom-dist')

  await project.install()
  await project.add(__ROOT__)
  const buildLog = await project.run('build')

  expect(buildLog.stdout).toContain(' ./lib/index.cjs')
  expect(buildLog.stdout).toContain(' ./lib/index.js')
  expect(buildLog.stdout).toContain(' ./lib/index.d.ts')

  expect(await project.readFile('lib/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('lib/index.js')).toMatchSnapshot()
  expect(await project.readFile('lib/index.d.ts')).toMatchSnapshot()

  project.remove()
})

test('should build `multi-export` package', async () => {
  const project = await _spawnProject('multi-export')

  await project.install()
  await project.add(__ROOT__)
  const buildLog = await project.run('build')

  expect(buildLog.stdout).toContain(' ./dist/index.cjs')
  expect(buildLog.stdout).toContain(' ./dist/index.js')
  expect(buildLog.stdout).toContain(' ./dist/index.d.ts')

  expect(await project.readFile('dist/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/index.js')).toMatchSnapshot()
  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()

  project.remove()
})

test('should build `monorepo` package', async () => {
  const project = await _spawnProject('monorepo')

  await project.install()
  await project.add(`-w ${__ROOT__}`)
  await project.run('build')

  project.remove()
})

describe('runtime: webpack v3', () => {
  test('import `dist/*.browser.js` from packge', async () => {
    const exportsDummy = await _spawnProject('exports-dummy')
    const runtime = await _spawnProject('runtime-webpack-v3')

    // install and build dummy package
    await exportsDummy.install()
    await exportsDummy.add(__ROOT__)
    await exportsDummy.run('build')

    // pack dummy package as tgz archive
    const exportsDummyArchive = await exportsDummy.pack()

    // install dummy archive
    await runtime.install()
    await runtime.add(exportsDummyArchive.path)

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
  test('import `dist/*.browser.js` from packge', async () => {
    const exportsDummy = await _spawnProject('exports-dummy')
    const runtime = await _spawnProject('runtime-next-js')

    // install and build dummy package
    await exportsDummy.install()
    await exportsDummy.add(__ROOT__)
    await exportsDummy.run('build')

    // pack dummy package as tgz archive
    const exportsDummyArchive = await exportsDummy.pack()

    // install dummy archive
    await runtime.install()
    await runtime.add(exportsDummyArchive.path)

    // build (uses webpack v3)
    await runtime.run('build')

    const buildManifest = runtime.require('.next/build-manifest.json')

    const pageFile = await runtime.readFile(path.join('.next', buildManifest.pages['/'][3]))

    expect(pageFile).toContain(`"dist/index.browser.js"`)
    expect(pageFile).toContain(`"dist/extra.browser.js"`)
  })
})
