import path from 'node:path'
import {describe, expect, test} from 'vitest'
import {spawnProject} from './env/spawnProject'

describe.skipIf(process.platform === 'win32')('cli > flags', () => {
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

  test('should build with `--quiet` flag suppressing output', async () => {
    const project = await spawnProject('ts')

    await project.install()

    const {stdout} = await project.run('build:quiet')

    // Should not contain build progress messages
    expect(stdout).not.toContain('Build type definitions')
    expect(stdout).not.toContain('- ts: ./src/index.ts → ./dist/index.d.ts')

    expect(stdout).not.toContain('Build javascript files')
    expect(stdout).not.toContain('- ts: ./src/index.ts → ./dist/index.cjs')

    // But should still produce the expected dist files
    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')

    await project.remove()
  })

  test('should warn with --strict when legacy fields are present', async () => {
    const project = await spawnProject('strict-legacy-fields')

    await project.install()

    // The build should succeed but with warnings
    const result = await project.run('build')

    // Errors can be in either stderr or stdout depending on how they're caught
    const output = result.stderr + result.stdout

    // Should warn on browser and typesVersions fields
    expect(output).toContain('the `browser` field is no longer needed')
    expect(output).toContain('the `typesVersions` field is no longer needed')

    await project.remove()
  })
})
