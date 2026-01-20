import {describe, expect, test} from 'vitest'
import {spawnProject} from './env/spawnProject'

describe.skipIf(process.platform === 'win32')('cli > basic', () => {
  test('should build `js` package', async () => {
    const project = await spawnProject('js')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.js → ./dist/index.mjs')
    expect(stdout).toContain('./src/index.js → ./dist/index.js')

    await project.remove()
  })

  test('should build `browser-bundle` package', async () => {
    const project = await spawnProject('browser-bundle')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.js → ./dist/index.js')
    expect(stdout).toContain('./src/index.js → ./dist/index.cjs')

    expect(stdout).toContain('./src/browser.js → ./dist/browser.js')
    expect(stdout).toContain('./src/browser.js → ./dist/browser.cjs')

    expect(await project.readFile('./dist/browser.js')).toMatchSnapshot('./dist/browser.js')
    expect(await project.readFile('./dist/browser.cjs')).toMatchSnapshot('./dist/browser.cjs')

    await project.remove()
  })

  test('should build `dummy-module` package', async () => {
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

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
    expect(await project.readFile('dist/index.cjs')).toMatchSnapshot('./dist/index.cjs')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
    expect(await project.readFile('dist/index.browser.js')).toMatchSnapshot(
      './dist/index.browser.js',
    )

    expect(await project.readFile('dist/extra.d.ts')).toMatchSnapshot('./dist/extra.d.ts')
    expect(await project.readFile('dist/extra.cjs')).toMatchSnapshot('./dist/extra.cjs')
    expect(await project.readFile('dist/extra.js')).toMatchSnapshot('./dist/extra.js')
    expect(await project.readFile('dist/extra.browser.js')).toMatchSnapshot(
      './dist/extra.browser.js',
    )

    await project.remove()
  })

  test('should build `custom-dist` package', async () => {
    const project = await spawnProject('custom-dist')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./lib/index.cjs')
    expect(stdout).toContain('./src/index.ts → ./lib/index.js')
    expect(stdout).toContain('./src/index.ts → ./lib/index.d.ts')

    expect(await project.readFile('lib/index.cjs')).toMatchSnapshot('./lib/index.cjs')
    expect(await project.readFile('lib/index.js')).toMatchSnapshot('./lib/index.js')
    expect(await project.readFile('lib/index.d.ts')).toMatchSnapshot('./lib/index.d.ts')

    await project.remove()
  })

  test('should build `multi-export` package', async () => {
    const project = await spawnProject('multi-export')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.cjs')
    expect(stdout).toContain('./src/index.ts → ./dist/index.js')
    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

    expect(stdout).toContain('./src/plugin.ts → ./dist/plugin.cjs')
    expect(stdout).toContain('./src/plugin.ts → ./dist/plugin.js')
    expect(stdout).toContain('./src/plugin.ts → ./dist/plugin.d.ts')

    expect(await project.readFile('dist/index.cjs')).toMatchSnapshot('./dist/index.cjs')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')

    expect(await project.readFile('dist/plugin.cjs')).toMatchSnapshot('./dist/plugin.cjs')
    expect(await project.readFile('dist/plugin.js')).toMatchSnapshot('./dist/plugin.js')
    expect(await project.readFile('dist/plugin.d.ts')).toMatchSnapshot('./dist/plugin.d.ts')

    await project.remove()
  })
})
