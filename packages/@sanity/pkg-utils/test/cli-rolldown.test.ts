import {describe, expect, test} from 'vitest'
import {spawnProject} from './env/spawnProject'

describe.skipIf(process.platform === 'win32')('cli > rolldown', () => {
  test('should build `ts-rolldown-without-extract` package', async () => {
    const project = await spawnProject('ts-rolldown-without-extract')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('with rolldown')
    expect(stdout).not.toContain('Check tsdoc release tags')

    expect(await project.readFile('dist/index.cjs')).toMatchSnapshot('./dist/index.cjs')
    expect(await project.readFile('dist/index.d.cts')).toMatchSnapshot('./dist/index.d.cts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')

    await project.remove()
  })

  test('should build `ts-rolldown-bundle-dev-dependency` package', async () => {
    const project = await spawnProject('ts-rolldown-bundle-dev-dependency')

    await project.install()

    const {stdout} = await project.run('build')

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

    await project.remove()
  })

  test('should build `ts-rolldown-bundle-peer-dependency` package', async () => {
    const project = await spawnProject('ts-rolldown-bundle-peer-dependency')

    await project.install()

    const {stdout} = await project.run('build')

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

    await project.remove()
  })

  test('should build `ts-rolldown-bundle-prod-dependency` package', async () => {
    const project = await spawnProject('ts-rolldown-bundle-prod-dependency')

    await project.install()

    const {stdout} = await project.run('build')

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

    await project.remove()
  })

  test('should build `ts-rolldown-inline-types-external-js` package', async () => {
    const project = await spawnProject('ts-rolldown-inline-types-external-js')

    await project.install()

    const {stdout} = await project.run('build')

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

    await project.remove()
  })

  test('should build `ts-rolldown` package', async () => {
    const project = await spawnProject('ts-rolldown')

    await project.install()

    const {stdout} = await project.run('build')

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

    await project.remove()
  })

  test('should build `tsgo` package', async () => {
    const project = await spawnProject('tsgo')

    await project.install()

    const {stdout} = await project.run('build')

    expect(stdout).toContain('with rolldown')
    expect(stdout).toContain('The `tsgo` option is experimental')

    expect(await project.readFile('dist/index.cjs')).toMatchSnapshot('./dist/index.cjs')
    expect(await project.readFile('dist/index.d.cts')).toMatchSnapshot('./dist/index.d.cts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')

    await project.remove()
  })
})
