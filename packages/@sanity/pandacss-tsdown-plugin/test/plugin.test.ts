import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown, type OutputAsset, type OutputChunk} from 'rolldown'
import {describe, expect, it} from 'vitest'
import {pandaCssPlugin, withCssCustomExports} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const basicFixtureDir = path.join(__dirname, 'fixtures/basic')
const basicEntry = path.join(basicFixtureDir, 'src/index.ts')

function snapshotMtimes(dir: string): Map<string, number> {
  const mtimes = new Map<string, number>()
  for (const entry of readdirSync(dir, {withFileTypes: true, recursive: true})) {
    if (!entry.isFile()) continue
    const filePath = path.join(entry.parentPath, entry.name)
    mtimes.set(filePath, statSync(filePath).mtimeMs)
  }
  return mtimes
}

describe('@sanity/pandacss-tsdown-plugin', () => {
  it('extracts Panda CSS into styles.css, transforms css({...}) calls by default, and emits nodeCompat shims', async () => {
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
    expect(entryChunk!.code).toContain('color_brand')
    expect(entryChunk!.code).toContain('padding_sm')
    expect(entryChunk!.code).not.toContain('createCss')
    expect(entryChunk!.code).not.toContain('@fixtures/pandacss-basic/styles.css')
  })

  it('keeps styled-system runtime calls when transform: false is set', async () => {
    const build = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [
        pandaCssPlugin({
          cwd: basicFixtureDir,
          transform: false,
        }),
      ],
    })

    const {output} = await build.generate({format: 'esm'})
    await build.close()

    const entryChunk = output.find(
      (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
    )
    expect(entryChunk).toBeDefined()
    expect(entryChunk!.code).toContain('createCss')
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

  it('runs Panda codegen idempotently at build start and respects codegen: false and outdir', async () => {
    const styledSystemDir = path.join(basicFixtureDir, 'styled-system')
    const runtimeFile = path.join(styledSystemDir, 'css/index.js')
    const typesFile = path.join(styledSystemDir, 'css/css.d.ts')

    // Regenerate missing or stale artifacts before bundling
    rmSync(styledSystemDir, {recursive: true, force: true})
    expect(existsSync(runtimeFile)).toBe(false)

    const firstBuild = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [pandaCssPlugin({cwd: basicFixtureDir})],
    })
    await firstBuild.generate({format: 'esm'})
    await firstBuild.close()

    expect(existsSync(runtimeFile)).toBe(true)
    expect(existsSync(typesFile)).toBe(true)

    const beforeMtimes = snapshotMtimes(styledSystemDir)
    expect(beforeMtimes.size).toBeGreaterThan(0)

    // Subsequent build leaves unchanged artifacts and their mtimes untouched
    const secondBuild = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [pandaCssPlugin({cwd: basicFixtureDir})],
    })
    await secondBuild.generate({format: 'esm'})
    await secondBuild.close()

    expect(snapshotMtimes(styledSystemDir)).toEqual(beforeMtimes)

    // codegen: false skips regenerating artifacts
    const originalRuntime = readFileSync(runtimeFile, 'utf8')
    writeFileSync(runtimeFile, '// custom-sentinel\n')
    try {
      const noCodegenBuild = await rolldown({
        cwd: basicFixtureDir,
        input: basicEntry,
        plugins: [pandaCssPlugin({cwd: basicFixtureDir, codegen: false})],
      })
      await noCodegenBuild.generate({format: 'esm'})
      await noCodegenBuild.close()
      expect(readFileSync(runtimeFile, 'utf8')).toBe('// custom-sentinel\n')
    } finally {
      writeFileSync(runtimeFile, originalRuntime)
    }

    // Custom outdir redirects codegen output
    const customOutdir = mkdtempSync(path.join(os.tmpdir(), 'panda-custom-outdir-'))
    try {
      const outdirBuild = await rolldown({
        cwd: basicFixtureDir,
        input: basicEntry,
        plugins: [pandaCssPlugin({cwd: basicFixtureDir, outdir: customOutdir})],
      })
      await outdirBuild.generate({format: 'esm'})
      await outdirBuild.close()
      expect(existsSync(path.join(customOutdir, 'css/index.js'))).toBe(true)
      expect(existsSync(path.join(customOutdir, 'css/css.d.ts'))).toBe(true)
    } finally {
      rmSync(customOutdir, {recursive: true, force: true})
    }
  })

  it('derives transform.filter.id from panda.config.ts include/exclude and skips scoping when neither is defined', async () => {
    const withGlobsPlugin = pandaCssPlugin({cwd: basicFixtureDir})
    const buildWithGlobs = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [withGlobsPlugin],
    })
    await buildWithGlobs.generate({format: 'esm'})
    await buildWithGlobs.close()

    expect(typeof withGlobsPlugin.transform).toBe('object')
    if (typeof withGlobsPlugin.transform === 'object' && withGlobsPlugin.transform !== null) {
      expect(withGlobsPlugin.transform.filter).toMatchObject({
        id: {
          include: [expect.any(RegExp)],
          exclude: expect.arrayContaining([expect.any(RegExp)]),
        },
      })
    }

    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'panda-no-globs-'))
    try {
      mkdirSync(path.join(tmpDir, 'src'), {recursive: true})
      writeFileSync(path.join(tmpDir, 'panda.config.ts'), 'export default {preflight: false}\n')
      writeFileSync(path.join(tmpDir, 'src/index.ts'), 'export const x = 1\n')

      const withoutGlobsPlugin = pandaCssPlugin({cwd: tmpDir})
      const buildWithoutGlobs = await rolldown({
        cwd: tmpDir,
        input: path.join(tmpDir, 'src/index.ts'),
        plugins: [withoutGlobsPlugin],
      })
      await buildWithoutGlobs.generate({format: 'esm'})
      await buildWithoutGlobs.close()

      expect(typeof withoutGlobsPlugin.transform).toBe('object')
      if (
        typeof withoutGlobsPlugin.transform === 'object' &&
        withoutGlobsPlugin.transform !== null
      ) {
        expect(withoutGlobsPlugin.transform.filter).toBeUndefined()
      }
    } finally {
      rmSync(tmpDir, {recursive: true, force: true})
    }
  })

  it('watches config dependencies and reloads driver, filters, and codegen on watchChange', async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'panda-watch-reload-'))
    try {
      mkdirSync(path.join(tmpDir, 'src'), {recursive: true})
      const tokensPath = path.join(tmpDir, 'tokens.ts')
      const configPath = path.join(tmpDir, 'panda.config.ts')
      const entryPath = path.join(tmpDir, 'src/index.ts')

      const writeTokens = (color: string, extraToken = '') =>
        writeFileSync(
          tokensPath,
          `export const brandColor = ${JSON.stringify(color)}\nexport const extraTokens = {${extraToken}}\n`,
        )
      const writeConfig = (extraExclude = '') =>
        writeFileSync(
          configPath,
          `import {brandColor, extraTokens} from './tokens.ts'
export default {
  preflight: false,
  include: ['./src/**/*.ts'],
  ${extraExclude}
  outdir: 'styled-system',
  theme: {
    extend: {
      tokens: {
        colors: {
          brand: {value: brandColor},
          ...extraTokens,
        },
      },
    },
  },
}
`,
        )

      writeTokens('rgb(1, 2, 3)')
      writeConfig()
      writeFileSync(
        entryPath,
        `import {css} from '../styled-system/css/index.js'
export const badge = css({color: 'brand'})
`,
      )

      const plugin = pandaCssPlugin({cwd: tmpDir, inject: true})

      const runBuild = async () => {
        const bundle = await rolldown({
          cwd: tmpDir,
          input: entryPath,
          external: ['./styles.css'],
          plugins: [plugin],
        })
        try {
          const {output} = await bundle.generate({format: 'esm'})
          const watchFiles = await bundle.watchFiles
          const cssAsset = output.find(
            (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'styles.css',
          )
          const entryChunk = output.find(
            (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
          )
          return {
            css: cssAsset ? String(cssAsset.source) : '',
            code: entryChunk?.code ?? '',
            watchFiles,
          }
        } finally {
          await bundle.close()
        }
      }

      const first = await runBuild()
      expect(first.css).toContain('#010203')
      expect(first.code).toContain('import "./styles.css";')
      expect(first.watchFiles.some((f) => f.endsWith('panda.config.ts'))).toBe(true)
      expect(first.watchFiles.some((f) => f.endsWith('tokens.ts'))).toBe(true)
      expect(
        readFileSync(path.join(tmpDir, 'styled-system/types/tokens.d.ts'), 'utf8'),
      ).not.toContain('"accent"')

      // Update imported token file and notify watchChange
      writeTokens('rgb(4, 5, 6)', 'accent: {value: "rgb(7, 8, 9)"}')
      const watchChangeHook =
        typeof plugin.watchChange === 'function' ? plugin.watchChange : plugin.watchChange?.handler
      await watchChangeHook?.call({} as never, tokensPath, {event: 'update'})

      const second = await runBuild()
      expect(second.css).toContain('#040506')
      expect(second.css).not.toContain('#010203')
      expect(
        readFileSync(path.join(tmpDir, 'styled-system/types/tokens.d.ts'), 'utf8'),
      ).toContain('"accent"')

      // Narrow config exclude to exclude src/index.ts and notify watchChange
      writeConfig(`exclude: ['./src/index.ts'],`)
      await watchChangeHook?.call({} as never, configPath, {event: 'update'})

      const third = await runBuild()
      expect(third.code).not.toContain('./styles.css')
    } finally {
      rmSync(tmpDir, {recursive: true, force: true})
    }
  })

  it('configures package.json exports via withCssCustomExports', async () => {
    const exportsConfig = withCssCustomExports(true, 'styles.css', false, undefined)

    expect(exportsConfig).toEqual({
      customExports: expect.any(Function),
    })

    if (
      typeof exportsConfig !== 'object' ||
      exportsConfig === null ||
      typeof exportsConfig.customExports !== 'function'
    ) {
      throw new Error('Expected customExports function')
    }

    const result = await exportsConfig.customExports(
      {'.': './dist/index.js'},
      {pkg: {name: '@fixtures/pandacss-basic'}, chunks: {}, isPublish: true},
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
