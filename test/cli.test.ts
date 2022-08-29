import path from 'path'
import {expect, test} from 'vitest'
import {_spawnProject} from './env'

const __ROOT__ = path.resolve(__dirname, '..')

test('should build `multi-export` package', async () => {
  const project = await _spawnProject('multi-export')

  await project.install()
  await project.add(__ROOT__)
  const buildLog = await project.run('build')

  expect(buildLog.stdout).toContain(' dist/index.cjs')
  expect(buildLog.stdout).toContain(' dist/index.js')
  expect(buildLog.stdout).toContain(' dist/index.d.ts')

  expect(await project.readFile('dist/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/index.js')).toMatchSnapshot()
  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()

  project.remove()
})

test('should build `custom-dist` package', async () => {
  const project = await _spawnProject('custom-dist')

  await project.install()
  await project.add(__ROOT__)
  const buildLog = await project.run('build')

  expect(buildLog.stdout).toContain(' lib/index.cjs')
  expect(buildLog.stdout).toContain(' lib/index.js')
  expect(buildLog.stdout).toContain(' lib/index.d.ts')

  expect(await project.readFile('lib/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('lib/index.js')).toMatchSnapshot()
  expect(await project.readFile('lib/index.d.ts')).toMatchSnapshot()

  project.remove()
})

test('should build `monorepo` package', async () => {
  const project = await _spawnProject('monorepo')

  await project.install()
  await project.add(`-w ${__ROOT__}`)
  await project.run('build')

  project.remove()
})

test('should build `node-package` package', async () => {
  const project = await _spawnProject('node-package')

  await project.install()
  await project.add(__ROOT__)
  await project.run('build')

  project.remove()
})

test('should build `web-package` package', async () => {
  const project = await _spawnProject('web-package')

  await project.install()
  await project.add(__ROOT__)
  await project.run('build')

  project.remove()
})
