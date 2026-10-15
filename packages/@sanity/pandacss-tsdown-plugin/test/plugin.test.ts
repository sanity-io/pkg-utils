import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown, type OutputAsset, type OutputChunk} from 'rolldown'
import {describe, expect, it} from 'vitest'
import {pandaCssPlugin} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const basicFixtureDir = path.join(__dirname, 'fixtures/basic')
const basicEntry = path.join(basicFixtureDir, 'src/index.ts')

describe('@sanity/pandacss-tsdown-plugin', () => {
  it('extracts Panda CSS into styles.css and emits nodeCompat shims by default', async () => {
    const build = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [
        pandaCssPlugin({
          cwd: basicFixtureDir,
          packageName: '@fixtures/pandacss-basic',
        }),
      ],
    })

    const {output} = await build.generate({format: 'esm'})
    await build.close()

    const cssAsset = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'styles.css',
    )
    expect(cssAsset).toBeDefined()
    const cssSource = String(cssAsset!.source)
    expect(cssSource).toContain('#010203')
    expect(cssSource).toContain('8px')
    expect(cssSource).not.toContain('--made-with-panda')

    const shimJs = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'styles-css.js',
    )
    const shimDts = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'styles-css.d.ts',
    )
    expect(shimJs).toBeDefined()
    expect(shimDts).toBeDefined()

    const entryChunk = output.find(
      (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
    )
    expect(entryChunk).toBeDefined()
    expect(entryChunk!.code).not.toContain('@fixtures/pandacss-basic/styles.css')
  })

  it('rewrites css({...}) calls at build time when transform: true', async () => {
    const build = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [
        pandaCssPlugin({
          cwd: basicFixtureDir,
          transform: true,
        }),
      ],
    })

    const {output} = await build.generate({format: 'esm'})
    await build.close()

    const entryChunk = output.find(
      (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
    )
    expect(entryChunk).toBeDefined()
    expect(entryChunk!.code).not.toContain('runtime-css-fallback')
    expect(entryChunk!.code).toContain('color_brand')
    expect(entryChunk!.code).toContain('padding_sm')
  })

  it('injects CSS side-effect import when inject: true', async () => {
    const build = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      external: ['@fixtures/pandacss-basic/styles.css'],
      plugins: [
        pandaCssPlugin({
          cwd: basicFixtureDir,
          packageName: '@fixtures/pandacss-basic',
          inject: true,
        }),
      ],
    })

    const {output} = await build.generate({format: 'esm'})
    await build.close()

    const entryChunk = output.find(
      (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
    )
    expect(entryChunk).toBeDefined()
    expect(entryChunk!.code.startsWith('import "@fixtures/pandacss-basic/styles.css";\n')).toBe(
      true,
    )
  })

  it('supports custom fileName and disabling nodeCompat shims', async () => {
    const build = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [
        pandaCssPlugin({
          cwd: basicFixtureDir,
          fileName: 'bundle.css',
          exports: {nodeCompat: false},
        }),
      ],
    })

    const {output} = await build.generate({format: 'esm'})
    await build.close()

    const cssAsset = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'bundle.css',
    )
    expect(cssAsset).toBeDefined()

    const shimJs = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'bundle-css.js',
    )
    expect(shimJs).toBeUndefined()
  })

  it('configures package.json exports via tsdownConfig hook', async () => {
    const plugin = pandaCssPlugin({cwd: basicFixtureDir})
    const config: Record<string, any> = {exports: true}
    await plugin.tsdownConfig!(config)

    expect(config.exports).toEqual({
      customExports: expect.any(Function),
    })

    const result = await config.exports.customExports(
      {'.': './dist/index.js'},
      {pkg: {name: '@fixtures/pandacss-basic'}, isPublish: true},
    )

    expect(result).toEqual({
      '.': './dist/index.js',
      './styles.css': {
        style: './dist/styles.css',
        browser: './dist/styles.css',
        module: './dist/styles.css',
        node: {
          types: './dist/styles-css.d.ts',
          default: './dist/styles-css.js',
        },
        default: './dist/styles.css',
      },
    })
  })
})
