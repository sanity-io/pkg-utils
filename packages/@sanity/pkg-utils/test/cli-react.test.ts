import {describe, expect, test} from 'vitest'
import {spawnProject} from './env/spawnProject'

describe.skipIf(process.platform === 'win32')('cli > react', () => {
  test('should build `react-18` package', async () => {
    const project = await spawnProject('react-18')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')
    expect(stdout).toContain('./src/index.ts → ./dist/index.js')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')

    await project.remove()
  })

  test('should build `react-19` package', async () => {
    const project = await spawnProject('react-19')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')
    expect(stdout).toContain('./src/index.ts → ./dist/index.js')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')

    await project.remove()
  })
})
