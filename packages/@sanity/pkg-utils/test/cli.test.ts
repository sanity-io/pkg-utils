import fs from 'node:fs/promises'
import path from 'node:path'
import {describe, expect, test} from 'vitest'
import {spawnProject, type SpawnedProject} from './env/spawnProject'

/**
 * Finds the single `dist` file matching `pattern` — shared (non-entry) chunks carry a content
 * hash in their filenames, so tests locate them by prefix instead of a fixed path.
 */
async function findDistFile(
  project: SpawnedProject,
  pattern: RegExp,
  dir = 'dist',
): Promise<string> {
  const files = await fs.readdir(path.resolve(project.cwd, dir))
  const matches = files.filter((file) => pattern.test(file))
  expect(matches, `expected exactly one file matching ${pattern} in ${dir}`).toHaveLength(1)
  return `${dir}/${matches[0]}`
}

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
    expect(stdout).toContain('dummy-module: ./src/extra.ts → ./dist/extra.d.ts')

    // commonjs
    expect(stdout).toContain('dummy-module: ./src/index.ts → ./dist/index.cjs')
    expect(stdout).toContain('dummy-module: ./src/index.ts → ./dist/index.browser.cjs')
    expect(stdout).toContain('dummy-module: ./src/extra.ts → ./dist/extra.cjs')
    expect(stdout).toContain('dummy-module: ./src/extra.ts → ./dist/extra.browser.cjs')

    // esm
    expect(stdout).toContain('dummy-module: ./src/index.ts → ./dist/index.js')
    expect(stdout).toContain('dummy-module: ./src/index.ts → ./dist/index.browser.js')
    expect(stdout).toContain('dummy-module: ./src/extra.ts → ./dist/extra.js')
    expect(stdout).toContain('dummy-module: ./src/extra.ts → ./dist/extra.browser.js')

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

  test('should preserve external side-effect imports in `external-side-effect` package', async () => {
    const project = await spawnProject('external-side-effect')
    const stdout = await project.run('build')

    expect(stdout).toContain('./src/index.ts → ./dist/index.js')
    expect(stdout).toContain('./src/index.ts → ./dist/index.cjs')

    const [distIndexJs, distIndexCjs] = await Promise.all([
      project.readFile('dist/index.js'),
      project.readFile('dist/index.cjs'),
    ])

    // A binding-less, side-effect-only import of an *external* package subpath must survive
    // tree-shaking (e.g. `import 'react-time-ago/locale/en'`). Previously our `moduleSideEffects`
    // treeshake option stripped these from the bundle. See https://github.com/sanity-io/plugins/pull/1468
    expect(distIndexJs).toContain('import "dummy-side-effects/side-effect"')
    expect(distIndexCjs).toContain('require("dummy-side-effects/side-effect")')

    // The exported value should still be present
    expect(distIndexJs).toContain('answer')
    expect(distIndexCjs).toContain('answer')
  })

  test('should build `node-condition` package', async () => {
    const project = await spawnProject('node-condition')
    const stdout = await project.run('build')

    // types
    expect(stdout).toContain('node-condition: ./src/index.ts → ./dist/index.d.ts')
    expect(stdout).toContain('node-condition: ./src/index.node.ts → ./dist/index.node.d.ts')

    // default runtime
    expect(stdout).toContain('node-condition: ./src/index.ts → ./dist/index.cjs')
    expect(stdout).toContain('node-condition: ./src/index.ts → ./dist/index.js')

    // node runtime — uses the node-only source
    expect(stdout).toContain('node-condition: ./src/index.node.ts → ./dist/index.node.cjs')
    expect(stdout).toContain('node-condition: ./src/index.node.ts → ./dist/index.node.js')

    const packageJson = JSON.parse(await project.readFile('package.json'))
    expect(packageJson.exports['.'].node.default).toBe('./dist/index.node.js')
    expect(packageJson.publishConfig.exports['.'].node.default).toBe('./dist/index.node.js')

    const [distIndexJs, distIndexCjs, distNodeJs, distNodeCjs, distIndexDts, distNodeDts] =
      await Promise.all([
        project.readFile('dist/index.js'),
        project.readFile('dist/index.cjs'),
        project.readFile('dist/index.node.js'),
        project.readFile('dist/index.node.cjs'),
        project.readFile('dist/index.d.ts'),
        project.readFile('dist/index.node.d.ts'),
      ])

    // PKG_VERSION is replaced at build time in every output
    expect(distIndexJs).toContain('version = "1.0.0"')
    expect(distIndexCjs).toContain('version = "1.0.0"')
    expect(distNodeJs).toContain('version = "1.0.0"')
    expect(distNodeCjs).toContain('version = "1.0.0"')

    // The node-only source uses node:fs and that import should survive into both formats.
    expect(distNodeJs).toContain('node:fs')
    expect(distNodeCjs).toContain('node:fs')
    // It should NOT appear in the default-runtime build, which uses ./src/index.ts.
    expect(distIndexJs).not.toContain('node:fs')
    expect(distIndexCjs).not.toContain('node:fs')

    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distIndexCjs).toMatchSnapshot('./dist/index.cjs')
    expect(distNodeJs).toMatchSnapshot('./dist/index.node.js')
    expect(distNodeCjs).toMatchSnapshot('./dist/index.node.cjs')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
    expect(distNodeDts).toMatchSnapshot('./dist/index.node.d.ts')
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

    expect(stdout).toContain('build canonical')
    expect(stdout).not.toContain('Check tsdoc release tags')

    expect(await project.readFile('dist/index.cjs')).toMatchSnapshot('./dist/index.cjs')
    expect(await project.readFile('dist/index.d.cts')).toMatchSnapshot('./dist/index.d.cts')
    expect(await project.readFile('dist/index.js')).toMatchSnapshot('./dist/index.js')
    expect(await project.readFile('dist/index.d.ts')).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-rolldown-bundle-dev-dependency` package', async () => {
    const project = await spawnProject('ts-rolldown-bundle-dev-dependency')
    const stdout = await project.run('build')

    expect(stdout).toContain('build canonical')

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

    expect(stdout).toContain('build canonical')

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

    expect(stdout).toContain('build canonical')

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

  test('should build `ts-rolldown-external-subpath-import` package', async () => {
    const project = await spawnProject('ts-rolldown-external-subpath-import')
    const stdout = await project.run('build')

    expect(stdout).toContain('build canonical')

    const [distIndexDcts, distIndexDts] = await Promise.all([
      project.readFile('dist/index.d.cts'),
      project.readFile('dist/index.d.ts'),
    ])

    // The `AgentActionPath` type is imported from the `@sanity/client/stega` subpath export.
    // `@sanity/client` is a prod dependency, so the emitted declarations must preserve the
    // original specifier instead of the resolved absolute filesystem path.
    expect(distIndexDcts).toContain('@sanity/client/stega')
    expect(distIndexDts).toContain('@sanity/client/stega')
    expect(distIndexDcts).not.toContain('node_modules')
    expect(distIndexDts).not.toContain('node_modules')
    // Snapshot the contents for easier debugging
    expect(distIndexDcts).toMatchSnapshot('./dist/index.d.cts')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `ts-rolldown-inline-types-external-js` package', async () => {
    const project = await spawnProject('ts-rolldown-inline-types-external-js')
    const stdout = await project.run('build')

    expect(stdout).toContain('build canonical')

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
    // Its types are not inlined either: type inlining follows the bundling decisions in v12
    // (the v11 `extract.bundledPackages` pattern of inlining only the *types* of an external
    // dependency has no successor), so the declarations import from `@sanity/client` instead
    expect(distIndexDcts).not.toContain('StackablePerspective')
    expect(distIndexDts).not.toContain('StackablePerspective')
    expect(distIndexDts).toContain('@sanity/client')
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

    expect(stdout).toContain('build canonical')

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
    // Shared (non-entry) chunks carry a content hash, so they can never take an entry's
    // filename (https://github.com/sanity-io/ui/issues/2262); entries keep stable names
    expect(await project.readFile(await findDistFile(project, /^c-[\w-]+\.cjs$/))).toMatchSnapshot(
      './dist/c-[hash].cjs',
    )
    expect(await project.readFile(await findDistFile(project, /^c-[\w-]+\.js$/))).toMatchSnapshot(
      './dist/c-[hash].js',
    )
    expect(
      await project.readFile(await findDistFile(project, /^c-[\w-]+\.d\.cts$/)),
    ).toMatchSnapshot('./dist/c-[hash].d.cts')
    expect(
      await project.readFile(await findDistFile(project, /^c-[\w-]+\.d\.ts$/)),
    ).toMatchSnapshot('./dist/c-[hash].d.ts')
  })

  test('should build `ts-namespace-reexport` package', async () => {
    const project = await spawnProject('ts-namespace-reexport')
    // The fixture enables `tsdoc: {rules: {'ae-missing-release-tag': 'error'}}`, so the build
    // (and the `--check` pass) succeeding is the regression assertion: the untaggable
    // `declare namespace <module>_d_exports` wrappers that the declaration bundler synthesizes
    // for namespace re-exports are exempt from the rule, while everything else stays checked
    // (https://github.com/sanity-io/pkg-utils/issues/3281)
    const stdout = await project.run('build')

    expect(stdout).toContain('build canonical')

    const [distIndexDts, distExtraDts] = await Promise.all([
      project.readFile('dist/index.d.ts'),
      project.readFile('dist/extra.d.ts'),
    ])

    // The wrapper of the namespace both entries re-export lives in a shared hashed chunk; the
    // wrapper of the `import * as` + `export {}` pattern is declared in the entry itself.
    // Neither can carry a release tag.
    expect(distIndexDts).toMatch(/import \{ \w+ as inner_d_exports \} from "\.\/inner-[\w-]+\.js"/)
    expect(distIndexDts).toContain('declare namespace other_d_exports')
    expect(distIndexDts).toContain('inner_d_exports as inner')
    expect(distIndexDts).toContain('other_d_exports as other')
    // The user symbol colliding with the wrapper name is deconflicted and stays exported
    expect(distIndexDts).toMatch(/inner_d_exports\$1 as inner_d_exports/)
    expect(distExtraDts).toContain('inner_d_exports as inner')

    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
    expect(distExtraDts).toMatchSnapshot('./dist/extra.d.ts')
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
    // A plain `.css` export subpath (no `source`) ships the file as-is and is left untouched
    expect(JSON.parse(await project.readFile('package.json')).exports['./css/styles.css']).toBe(
      './src/css/styles.css',
    )
  })

  test('should build `css-entry` package', async () => {
    const project = await spawnProject('css-entry')
    const stdout = await project.run('build')

    const [distStylesCss, distStylesShim, distStylesShimDts, pkg] = await Promise.all([
      project.readFile('dist/ui/styles.css'),
      project.readFile('dist/ui/styles-css.js'),
      project.readFile('dist/ui/styles-css.d.ts'),
      project.readFile('package.json'),
    ])

    // A `.css` export subpath with a `source` builds through `@tsdown/css`, emitting the
    // stylesheet at the path its subpath promises
    expect(stdout).toContain('./src/ui/styles.css → ./dist/ui/styles.css')
    // …minified, like `vanillaExtract` output
    expect(distStylesCss).toContain('#010203')
    expect(distStylesCss).not.toContain('rgb(1, 2, 3)')
    // The pure-CSS entry leaves no JS chunk behind
    await expect(project.readFile('dist/ui/styles.js')).rejects.toThrow()
    // `exports.nodeCompat` emits the no-op JS shim and its declaration file
    expect(distStylesShim).toContain('No-op shim for `ui/styles.css`')
    expect(distStylesShimDts).toContain('export {}')
    // …and fills in the export conditions the author left out, keeping `source` out of the
    // publish map
    const {exports: pkgExports, publishConfig} = JSON.parse(pkg)
    expect(pkgExports['./ui/styles.css']).toEqual({
      source: './src/ui/styles.css',
      types: './dist/ui/styles-css.d.ts',
      browser: './dist/ui/styles.css',
      style: './dist/ui/styles.css',
      node: './dist/ui/styles-css.js',
      default: './dist/ui/styles-css.js',
    })
    expect(publishConfig.exports['./ui/styles.css']).toEqual({
      types: './dist/ui/styles-css.d.ts',
      browser: './dist/ui/styles.css',
      style: './dist/ui/styles.css',
      node: './dist/ui/styles-css.js',
      default: './dist/ui/styles-css.js',
    })
    // The stylesheet is not imported by any JS entry, so nothing is injected
    expect(await project.readFile('dist/ui/index.js')).not.toMatch(
      /^\s*import ["'][^"']*styles\.css["']/m,
    )

    expect(distStylesCss).toMatchSnapshot('./dist/ui/styles.css')
  })

  test('should build `css-import` package', async () => {
    const project = await spawnProject('css-import')
    await project.run('build')

    const [distIndexJs, distStyleCss, distStyleShim, pkg] = await Promise.all([
      project.readFile('dist/index.js'),
      project.readFile('dist/style.css'),
      project.readFile('dist/style-css.js'),
      project.readFile('package.json'),
    ])

    // CSS imported from a JS entry merges into a single `style.css`, minified
    expect(distIndexJs).not.toContain('color:')
    expect(distStyleCss).toContain('#040506')
    // `@tsdown/css` would inject a relative `import "./style.css"`, which throws in runtimes
    // that cannot load `.css` files. `exports.nodeCompat` injects the self-referential
    // specifier of the conditional export instead.
    expect(distIndexJs).toContain(`import "css-import/style.css"`)
    expect(distIndexJs).not.toContain(`import "./style.css"`)
    expect(distStyleShim).toContain('No-op shim for `style.css`')
    expect(JSON.parse(pkg).exports['./style.css']).toEqual({
      types: './dist/style-css.d.ts',
      browser: './dist/style.css',
      style: './dist/style.css',
      node: './dist/style-css.js',
      default: './dist/style-css.js',
    })

    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distStyleCss).toMatchSnapshot('./dist/style.css')
  })

  test('should build `sanity-plugin-with-styled-components` package', async () => {
    const project = await spawnProject('sanity-plugin-with-styled-components')
    await project.run('build')

    const [distChunksColorInput, distIndexJs, distIndexDts] = await Promise.all([
      project.readFile(await findDistFile(project, /^ColorInput-[\w-]+\.js$/)),
      project.readFile('dist/index.js'),
      project.readFile('dist/index.d.ts'),
    ])

    // The ColorInput component should have the styled-components transform applied (oxc's
    // native port of `babel-plugin-styled-components`), which adds a static `.withConfig` call
    // with `displayName` and `componentId`, and minifies the CSS in the template literal
    expect(distChunksColorInput).toContain('.withConfig({')
    expect(distChunksColorInput).toContain('displayName: "CustomTextInput"')
    expect(distChunksColorInput).toContain('componentId:')
    // Unlike `babel-plugin-styled-components`, the oxc transform keeps the tagged template
    // literal (transpiling it wouldn't improve tree-shaking, as oxc doesn't add a
    // `/*#__PURE__*/` annotation to the transpiled call expression either - see
    // https://github.com/rollup/rollup/issues/4035)
    expect(distChunksColorInput).toContain('styled.input.attrs({')
    // React Compiler memoizes the component through its runtime cache
    expect(distChunksColorInput).toContain('$ = c(')
    // The index has a lazy loaded import to the (content-hashed) chunk
    expect(distIndexJs).toMatch(/lazy\(\(\) => import\("\.\/ColorInput-[\w-]+\.js"\)\)/)
    // The index d.ts inlines props that comes from the lazy loaded chunk
    expect(distIndexDts).toContain('interface ColorOptions')

    expect(distChunksColorInput).toMatchSnapshot('./dist/ColorInput-[hash].js')
    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
  })

  test('should build `sanity-plugin-with-vanilla-extract` package', async () => {
    const project = await spawnProject('sanity-plugin-with-vanilla-extract')
    await project.run('build')

    const [
      distChunksColorInput,
      distIndexJs,
      distIndexDts,
      distBundleCss,
      distBundleCssShim,
      distBundleCssShimDts,
      pkg,
    ] = await Promise.all([
      project.readFile(await findDistFile(project, /^ColorInput-[\w-]+\.js$/)),
      project.readFile('dist/index.js'),
      project.readFile('dist/index.d.ts'),
      project.readFile('dist/bundle.css'),
      project.readFile('dist/bundle-css.js'),
      project.readFile('dist/bundle-css.d.ts'),
      project.readFile('package.json'),
    ])

    // The inline CSS should be extracted to a separate file
    expect(distChunksColorInput).not.toContain('border:')
    expect(distBundleCss).toContain('border:')
    // The CSS side effectful imports should remain
    expect(distIndexJs).toContain(`import "@sanity/ui/styles.css"`)
    // `vanillaExtract` compat mode injects the self-referential bundle.css import automatically
    expect(distIndexJs).toContain(`import "sanity-plugin-with-vanilla-extract/bundle.css"`)
    // …emits a no-op JS shim for CSS-unaware runtimes (named `bundle-css.js`, not
    // `bundle.css.js`, so vanilla-extract's `cssFileFilter` does not match it). The shim has
    // no JS syntax on purpose: it parses as both CommonJS and an ES module.
    expect(distBundleCssShim).toContain('No-op shim for `bundle.css`')
    // …emits the shim's `.d.ts` (the conditional export's `types` target); no separate
    // `bundle.css.d.ts` is needed
    expect(distBundleCssShimDts).toContain('export {}')
    await expect(project.readFile('dist/bundle.css.d.ts')).rejects.toThrow()
    // …and declares the conditional `./bundle.css` export in package.json
    expect(JSON.parse(pkg).exports['./bundle.css']).toEqual({
      types: './dist/bundle-css.d.ts',
      browser: './dist/bundle.css',
      style: './dist/bundle.css',
      node: './dist/bundle-css.js',
      default: './dist/bundle-css.js',
    })
    // React Compiler memoizes the component through its runtime cache
    expect(distChunksColorInput).toContain('$ = c(')
    // The index has a lazy loaded import to the (content-hashed) chunk
    expect(distIndexJs).toMatch(/lazy\(\(\) => import\("\.\/ColorInput-[\w-]+\.js"\)\)/)
    // The index d.ts inlines props that comes from the lazy loaded chunk
    expect(distIndexDts).toContain('interface ColorOptions')

    expect(distChunksColorInput).toMatchSnapshot('./dist/ColorInput-[hash].js')
    expect(distIndexJs).toMatchSnapshot('./dist/index.js')
    expect(distIndexDts).toMatchSnapshot('./dist/index.d.ts')
    expect(distBundleCss).toMatchSnapshot('./dist/bundle.css')
  })

  test('should build with `--emitDeclarationOnly` emitting declarations only', async () => {
    const project = await spawnProject('ts')
    await project.run('clean')
    const stdout = await project.pkg(['build', '--emitDeclarationOnly'])

    expect(stdout).toContain('ts: ./src/index.ts → ./dist/index.d.ts')
    expect(stdout).not.toContain('→ ./dist/index.js')

    // A types-only build emits declaration files only (the CJS pass emits its JS regardless
    // of `dts.emitDtsOnly`, so everything else is removed afterwards)
    const files = await fs.readdir(path.resolve(project.cwd, 'dist'))
    expect(files.filter((file) => !/\.d\.[mc]?ts(\.map)?$/.test(file))).toEqual([])
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
