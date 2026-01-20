import {describe, expect, test} from 'vitest'
import {spawnProject} from './env/spawnProject'

describe.skipIf(process.platform === 'win32')('cli > styling', () => {
  test('should build `css-export` package', async () => {
    const project = await spawnProject('css-export')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('./src/index.js → ./dist/index.js')
    // @TODO test that styles.css is available as an export from the package

    await project.remove()
  })

  test('should build `sanity-plugin-with-styled-components` package', async () => {
    const project = await spawnProject('sanity-plugin-with-styled-components')

    await project.install()

    await project.run('build')

    const [distChunksColorInput, distIndexJs, distIndexDts] = await Promise.all([
      project.readFile('dist/_chunks-es/ColorInput.js'),
      project.readFile('dist/index.js'),
      project.readFile('dist/index.d.ts'),
    ])

    // The ColorInput component should have babel-plugin-styled-components applied, which adds a static `.withConfig` call
    expect(distChunksColorInput).toContain('.withConfig({')
    // React Compiler adds a `c` function call
    expect(distChunksColorInput).toContain('const $ = c(')
    // The index has a lazy loaded import to the chunk
    expect(distIndexJs).toContain('lazy(() => import("./_chunks-es/ColorInput.js"))')
    // The index d.ts inlines props that comes from the lazy loaded chunk
    expect(distIndexDts).toContain('interface ColorOptions')

    expect(distChunksColorInput).toMatchSnapshot('./dist/_chunks-es/ColorInput.js')
    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')

    await project.remove()
  })

  test('should build `sanity-plugin-with-vanilla-extract` package', async () => {
    const project = await spawnProject('sanity-plugin-with-vanilla-extract')

    await project.install()

    await project.run('build')

    const [distChunksColorInput, distIndexJs, distIndexDts, distBundleCss] = await Promise.all([
      project.readFile('dist/_chunks-es/ColorInput.js'),
      project.readFile('dist/index.js'),
      project.readFile('dist/index.d.ts'),
      project.readFile('dist/bundle.css'),
    ])

    // The inline CSS should be extracted to a separate file
    expect(distChunksColorInput).not.toContain('border:')
    expect(distBundleCss).toContain('border:')
    // The CSS side effectful imports should remain
    expect(distIndexJs).toContain(`import "@sanity/ui/css/index.css"`)
    expect(distIndexJs).toContain(`import "./bundle.css"`)
    // React Compiler adds a `c` function call
    expect(distChunksColorInput).toContain('const $ = c(')
    // The index has a lazy loaded import to the chunk
    expect(distIndexJs).toContain('lazy(() => import("./_chunks-es/ColorInput.js"))')
    // The index d.ts inlines props that comes from the lazy loaded chunk
    expect(distIndexDts).toContain('interface ColorOptions')

    expect(distChunksColorInput).toMatchSnapshot('./dist/_chunks-es/ColorInput.js')
    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
    expect(distBundleCss).toMatchSnapshot('./dist/bundle.css')

    await project.remove()
  })
})
