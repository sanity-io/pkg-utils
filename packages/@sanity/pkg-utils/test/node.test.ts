import {expect, test} from 'vitest'
import {spawnProject} from './env/spawnProject'

test.skipIf(process.platform === 'win32')('should build `node-api` package', async () => {
  const project = await spawnProject('node-api')

  await project.install()

  const {stdout} = await project.run('build')

  expect(stdout).toContain('successfully built')

  await project.remove()
})
