import path from 'path'
import {expect, test} from 'vitest'
import {_spawnProject} from './_lib'

const __ROOT__ = path.resolve(__dirname, '..')

test('should build a multi-export package', async () => {
  const project = await _spawnProject('multiexport')

  await project.install()

  await project.add(__ROOT__)

  await project.run('build')

  project.remove()

  expect(await project.readFile('dist/index.cjs')).toMatchSnapshot()
  expect(await project.readFile('dist/index.js')).toMatchSnapshot()
  expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot()
})
