import {describe, expect, test} from 'vitest'
import {spawnProject} from './env/spawnProject'

describe.skipIf(process.platform === 'win32')('cli', () => {
  test('should build `js` package', async () => {
    const project = await spawnProject('js')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.js → ./dist/index.mjs')
    expect(stdout).toContain('./src/index.js → ./dist/index.js')
  })

  test('should build `browser-bundle` package', async () => {
    const project = await spawnProject('browser-bundle')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.js → ./dist/index.js')
    expect(stdout).toContain('./src/index.js → ./dist/index.cjs')

    expect(stdout).toContain('./src/browser.js → ./dist/browser.js')
    expect(stdout).toContain('./src/browser.js → ./dist/browser.cjs')

    expect(await project.readFile('./dist/browser.js')).toMatchSnapshot('./dist/browser.js')
    expect(await project.readFile('./dist/browser.cjs')).toMatchSnapshot('./dist/browser.cjs')
  })

  test('should build `dummy-module` package', async () => {
    const project = await spawnProject('dummy-module')
    const stdout = await project.run('build')

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
  })

  test('should build `custom-dist` package', async () => {
    const project = await spawnProject('custom-dist')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./lib/index.cjs')
    expect(stdout).toContain('./src/index.ts → ./lib/index.js')
    expect(stdout).toContain('./src/index.ts → ./lib/index.d.ts')

    expect(await project.readFile('lib/index.cjs')).toMatchSnapshot('./lib/index.cjs')
    expect(await project.readFile('lib/index.js')).toMatchSnapshot('./lib/index.js')
    expect(await project.readFile('lib/index.d.ts')).toMatchSnapshot('./lib/index.d.ts')
  })

  test('should build `multi-export` package', async () => {
    const project = await spawnProject('multi-export')
    const stdout = await project.run('build')

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
  })

  test('should build `ts` package', async () => {
    const project = await spawnProject('ts')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-without-extract` package', async () => {
    const project = await spawnProject('ts-without-extract')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-rolldown-without-extract` package', async () => {
    const project = await spawnProject('ts-rolldown-without-extract')
    const stdout = await project.run('build')

    expect(stdout).toContain('with rolldown')
    expect(stdout).not.toContain('Check tsdoc release tags')

    expect(await project.readFile('dist/index.cjs')).toMatchSnapshot('./dist/index.cjs')
    expect(await project.readFile('dist/index.d.cts')).toMatchSnapshot('./dist/index.d.cts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-rolldown-bundle-dev-dependency` package', async () => {
    const project = await spawnProject('ts-rolldown-bundle-dev-dependency')
    const stdout = await project.run('build')

    expect(stdout).toContain('with rolldown')

    const [distIndexCjs, distIndexDcts, distIndexJs, distIndexDts] = await Promise.all([
      project.readFile('dist/index.cjs'),
      project.readFile('dist/index.d.cts'),
      project.readFile('dist/index.js'),
      project.readFile('dist/index.d.ts'),
    ])

    // The `validateApiPerspective` function is re-exported from `@sanity/client`
    expect(distIndexCjs).toContain('validateApiPerspective')
    expect(distIndexJs).toContain('validateApiPerspective')
    expect(distIndexDcts).toContain('validateApiPerspective')
    expect(distIndexDts).toContain('validateApiPerspective')
    // The `@sanity/client` dependency is a devDependency, so it should be inlined
    expect(distIndexCjs).toContain('Invalid API perspective value')
    expect(distIndexJs).toContain('Invalid API perspective value')
    expect(distIndexDcts).toContain('StackablePerspective')
    expect(distIndexDts).toContain('StackablePerspective')
    // The `SanityLogo` is re-exported from `@sanity/logos`
    expect(distIndexCjs).toContain('SanityLogo')
    expect(distIndexJs).toContain('SanityLogo')
    expect(distIndexDcts).toContain('SanityLogo')
    expect(distIndexDts).toContain('SanityLogo')
    // The `@sanity/logos` dependency is setup to be external even though it's a devDependency
    expect(distIndexCjs).not.toContain('"sanity-logo"')
    expect(distIndexJs).not.toContain('"sanity-logo"')
    expect(distIndexDcts).not.toContain('SanityLogoProps')
    expect(distIndexDts).not.toContain('SanityLogoProps')
    // The `RemoveIcon` is re-exported from `@sanity/icons`
    expect(distIndexCjs).toContain('RemoveIcon')
    expect(distIndexJs).toContain('RemoveIcon')
    expect(distIndexDcts).toContain('RemoveIcon')
    expect(distIndexDts).toContain('RemoveIcon')
    // The `@sanity/icons` dependency should be inlined
    expect(distIndexCjs).not.toContain('@sanity/icons')
    expect(distIndexJs).not.toContain('@sanity/icons')
    expect(distIndexDcts).not.toContain('@sanity/icons')
    expect(distIndexDts).not.toContain('@sanity/icons')
    // Snapshot the contents for easier debugging
    expect(distIndexCjs).toMatchSnapshot('./dist/index.cjs')
    expect(distIndexDcts).toMatchSnapshot('./dist/index.d.cts')
    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-rolldown-bundle-peer-dependency` package', async () => {
    const project = await spawnProject('ts-rolldown-bundle-peer-dependency')
    const stdout = await project.run('build')

    expect(stdout).toContain('with rolldown')

    const [distIndexCjs, distIndexDcts, distIndexJs, distIndexDts] = await Promise.all([
      project.readFile('dist/index.cjs'),
      project.readFile('dist/index.d.cts'),
      project.readFile('dist/index.js'),
      project.readFile('dist/index.d.ts'),
    ])

    // The `validateApiPerspective` function is re-exported from `@sanity/client`
    expect(distIndexCjs).toContain('validateApiPerspective')
    expect(distIndexJs).toContain('validateApiPerspective')
    expect(distIndexDcts).toContain('validateApiPerspective')
    expect(distIndexDts).toContain('validateApiPerspective')
    // The `@sanity/client` dependency is a peerDependency, so it should not be inlined
    expect(distIndexCjs).not.toContain('Invalid API perspective value')
    expect(distIndexJs).not.toContain('Invalid API perspective value')
    expect(distIndexDcts).not.toContain('StackablePerspective')
    expect(distIndexDts).not.toContain('StackablePerspective')
    // The `SanityLogo` is re-exported from `@sanity/logos`
    expect(distIndexCjs).toContain('SanityLogo')
    expect(distIndexJs).toContain('SanityLogo')
    expect(distIndexDcts).toContain('SanityLogo')
    expect(distIndexDts).toContain('SanityLogo')
    // The `@sanity/logos` dependency is a peerDependency, so it should not be inlined
    expect(distIndexCjs).not.toContain('"sanity-logo"')
    expect(distIndexJs).not.toContain('"sanity-logo"')
    expect(distIndexDcts).not.toContain('SanityLogoProps')
    expect(distIndexDts).not.toContain('SanityLogoProps')
    // The `RemoveIcon` is re-exported from `@sanity/icons`
    expect(distIndexCjs).toContain('RemoveIcon')
    expect(distIndexJs).toContain('RemoveIcon')
    expect(distIndexDcts).toContain('RemoveIcon')
    expect(distIndexDts).toContain('RemoveIcon')
    // The `@sanity/icons` is inlined even though it being a peer dependency by using the `external` callback option.
    expect(distIndexCjs).not.toContain('@sanity/icons')
    expect(distIndexJs).not.toContain('@sanity/icons')
    expect(distIndexDcts).not.toContain('@sanity/icons')
    expect(distIndexDts).not.toContain('@sanity/icons')
    // Snapshot the contents for easier debugging
    expect(distIndexCjs).toMatchSnapshot('./dist/index.cjs')
    expect(distIndexDcts).toMatchSnapshot('./dist/index.d.cts')
    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-rolldown-bundle-prod-dependency` package', async () => {
    const project = await spawnProject('ts-rolldown-bundle-prod-dependency')
    const stdout = await project.run('build')

    expect(stdout).toContain('with rolldown')

    const [distIndexCjs, distIndexDcts, distIndexJs, distIndexDts] = await Promise.all([
      project.readFile('dist/index.cjs'),
      project.readFile('dist/index.d.cts'),
      project.readFile('dist/index.js'),
      project.readFile('dist/index.d.ts'),
    ])

    // The `validateApiPerspective` function is re-exported from `@sanity/client`
    expect(distIndexCjs).toContain('validateApiPerspective')
    expect(distIndexJs).toContain('validateApiPerspective')
    expect(distIndexDcts).toContain('validateApiPerspective')
    expect(distIndexDts).toContain('validateApiPerspective')
    // The `@sanity/client` dependency is a prod dependency, so it should not be inlined
    expect(distIndexCjs).not.toContain('Invalid API perspective value')
    expect(distIndexJs).not.toContain('Invalid API perspective value')
    expect(distIndexDcts).not.toContain('StackablePerspective')
    expect(distIndexDts).not.toContain('StackablePerspective')
    // The `SanityLogo` is re-exported from `@sanity/logos`
    expect(distIndexCjs).toContain('SanityLogo')
    expect(distIndexJs).toContain('SanityLogo')
    expect(distIndexDcts).toContain('SanityLogo')
    expect(distIndexDts).toContain('SanityLogo')
    // The `@sanity/logos` dependency is a prod dependency, so it should not be inlined
    expect(distIndexCjs).not.toContain('"sanity-logo"')
    expect(distIndexJs).not.toContain('"sanity-logo"')
    expect(distIndexDcts).not.toContain('SanityLogoProps')
    expect(distIndexDts).not.toContain('SanityLogoProps')
    // The `RemoveIcon` is re-exported from `@sanity/icons`
    expect(distIndexCjs).toContain('RemoveIcon')
    expect(distIndexJs).toContain('RemoveIcon')
    expect(distIndexDcts).toContain('RemoveIcon')
    expect(distIndexDts).toContain('RemoveIcon')
    // The `@sanity/icons` is inlined even though it being a prod dependency by using the `external` callback option to remove it from the default inferred list.
    expect(distIndexCjs).not.toContain('@sanity/icons')
    expect(distIndexJs).not.toContain('@sanity/icons')
    // It's also inlining its types by using the `bundledPackages` option.
    expect(distIndexDcts).not.toContain('@sanity/icons')
    expect(distIndexDts).not.toContain('@sanity/icons')
    // Snapshot the contents for easier debugging
    expect(distIndexCjs).toMatchSnapshot('./dist/index.cjs')
    expect(distIndexDcts).toMatchSnapshot('./dist/index.d.cts')
    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-rolldown-inline-types-external-js` package', async () => {
    const project = await spawnProject('ts-rolldown-inline-types-external-js')
    const stdout = await project.run('build')

    expect(stdout).toContain('with rolldown')

    const [distIndexCjs, distIndexDcts, distIndexJs, distIndexDts] = await Promise.all([
      project.readFile('dist/index.cjs'),
      project.readFile('dist/index.d.cts'),
      project.readFile('dist/index.js'),
      project.readFile('dist/index.d.ts'),
    ])

    // The `validateApiPerspective` function is re-exported from `@sanity/client`
    expect(distIndexCjs).toContain('validateApiPerspective')
    expect(distIndexJs).toContain('validateApiPerspective')
    expect(distIndexDcts).toContain('validateApiPerspective')
    expect(distIndexDts).toContain('validateApiPerspective')
    // The `@sanity/client` is a prod dependency, so it should not have inlined JS
    expect(distIndexCjs).not.toContain('Invalid API perspective value')
    expect(distIndexJs).not.toContain('Invalid API perspective value')
    // Though the types for `@sanity/client` should be inlined as `bundledPackages` is used
    expect(distIndexDcts).toContain('StackablePerspective')
    expect(distIndexDts).toContain('StackablePerspective')
    // The `SanityLogo` is re-exported from `@sanity/logos`
    expect(distIndexCjs).toContain('SanityLogo')
    expect(distIndexJs).toContain('SanityLogo')
    expect(distIndexDcts).toContain('SanityLogo')
    expect(distIndexDts).toContain('SanityLogo')
    // The `@sanity/logos` dependency is a prod dependency, so it should not be inlined
    expect(distIndexCjs).not.toContain('"sanity-logo"')
    expect(distIndexJs).not.toContain('"sanity-logo"')
    expect(distIndexDcts).not.toContain('SanityLogoProps')
    expect(distIndexDts).not.toContain('SanityLogoProps')
    // The `RemoveIcon` is re-exported from `@sanity/icons`
    expect(distIndexCjs).toContain('RemoveIcon')
    expect(distIndexJs).toContain('RemoveIcon')
    expect(distIndexDcts).toContain('RemoveIcon')
    expect(distIndexDts).toContain('RemoveIcon')
    // The `@sanity/icons` is inlined even though it being a prod dependency by using the `external` callback option to remove it from the default inferred list.
    expect(distIndexCjs).not.toContain('@sanity/icons')
    expect(distIndexJs).not.toContain('@sanity/icons')
    // It's also inlining its types by using the `bundledPackages` option.
    expect(distIndexDcts).not.toContain('@sanity/icons')
    expect(distIndexDts).not.toContain('@sanity/icons')
    // Snapshot the contents for easier debugging
    expect(distIndexCjs).toMatchSnapshot('./dist/index.cjs')
    expect(distIndexDcts).toMatchSnapshot('./dist/index.d.cts')
    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-rolldown` package', async () => {
    const project = await spawnProject('ts-rolldown')
    const stdout = await project.run('build')

    expect(stdout).toContain('with rolldown')

    expect(await project.readFile('dist/index.cjs')).toMatchSnapshot('./dist/index.cjs')
    expect(await project.readFile('dist/index.d.cts')).toMatchSnapshot('./dist/index.d.cts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
    expect(await project.readFile('dist/a.cjs')).toMatchSnapshot('./dist/a.cjs')
    expect(await project.readFile('dist/a.d.cts')).toMatchSnapshot('./dist/a.d.cts')
    expect(await project.readFile('dist/a.js')).toMatchSnapshot('./dist/a.js')
    expect(await project.readFile('dist/a.d.ts')).toMatchSnapshot('./dist/a.d.ts')
    expect(await project.readFile('dist/b.cjs')).toMatchSnapshot('./dist/b.cjs')
    expect(await project.readFile('dist/b.d.cts')).toMatchSnapshot('./dist/b.d.cts')
    expect(await project.readFile('dist/b.js')).toMatchSnapshot('./dist/b.js')
    expect(await project.readFile('dist/b.d.ts')).toMatchSnapshot('./dist/b.d.ts')
    expect(await project.readFile('dist/_chunks-cjs/c.cjs')).toMatchSnapshot(
      './dist/_chunks-cjs/c.cjs',
    )
    expect(await project.readFile('dist/_chunks-es/c.js')).toMatchSnapshot('./dist/_chunks-es/c.js')
    expect(await project.readFile('dist/_chunks-dts/c.d.cts')).toMatchSnapshot(
      './dist/_chunks-dts/c.d.cts',
    )
    expect(await project.readFile('dist/_chunks-dts/c.d.ts')).toMatchSnapshot(
      './dist/_chunks-dts/c.d.ts',
    )
  })

  test('should build `tsgo` package', async () => {
    const project = await spawnProject('tsgo')
    const stdout = await project.run('build')

    expect(stdout).toContain('with rolldown')
    expect(stdout).toContain('The `tsgo` option is experimental')

    expect(await project.readFile('dist/index.cjs')).toMatchSnapshot('./dist/index.cjs')
    expect(await project.readFile('dist/index.d.cts')).toMatchSnapshot('./dist/index.d.cts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-node16` package', async () => {
    const project = await spawnProject('ts-node16')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-bundler` package', async () => {
    const project = await spawnProject('ts-bundler')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `react-18` package', async () => {
    const project = await spawnProject('react-18')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')
    expect(stdout).toContain('./src/index.ts → ./dist/index.js')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
  })

  test('should build `react-19` package', async () => {
    const project = await spawnProject('react-19')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.d.ts')
    expect(stdout).toContain('./src/index.ts → ./dist/index.js')

    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
  })

  test('should build `css-export` package', async () => {
    const project = await spawnProject('css-export')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.js → ./dist/index.js')
    // @TODO test that styles.css is available as an export from the package
  })

  test('should build `sanity-plugin-with-styled-components` package', async () => {
    const project = await spawnProject('sanity-plugin-with-styled-components')
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
  })

  test('should build `sanity-plugin-with-vanilla-extract` package', async () => {
    const project = await spawnProject('sanity-plugin-with-vanilla-extract')
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
  })

  test('should build with `--quiet` flag suppressing output', async () => {
    const project = await spawnProject('ts')
    const stdout = await project.run('build:quiet')

    // Should not contain build progress messages
    expect(stdout).not.toContain('Build type definitions')
    expect(stdout).not.toContain('- ts: ./src/index.ts → ./dist/index.d.ts')

    expect(stdout).not.toContain('Build javascript files')
    expect(stdout).not.toContain('- ts: ./src/index.ts → ./dist/index.cjs')

    // But should still produce the expected dist files
    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should warn with --strict when legacy fields are present', async () => {
    const project = await spawnProject('strict-legacy-fields')

    // The build should succeed but with warnings
    const stdout = await project.run('build')

    // Should warn on browser and typesVersions fields
    expect(stdout).toContain('the `browser` field is no longer needed')
    expect(stdout).toContain('the `typesVersions` field is no longer needed')
  })
})
