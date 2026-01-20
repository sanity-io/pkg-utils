import {describe, expect, test} from 'vitest'
import {spawnProject} from './env/spawnProject'

describe.skipIf(process.platform === 'win32')('cli > typescript', () => {
  test('should build `ts` package', async () => {
    const project = await spawnProject('ts')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')

    await project.remove()
  })

  test('should build `ts-without-extract` package', async () => {
    const project = await spawnProject('ts-without-extract')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')

    await project.remove()
  })

  test('should build `ts-node16` package', async () => {
    const project = await spawnProject('ts-node16')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')

    await project.remove()
  })

  test('should build `ts-bundler` package', async () => {
    const project = await spawnProject('ts-bundler')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')

    await project.remove()
  })
})
