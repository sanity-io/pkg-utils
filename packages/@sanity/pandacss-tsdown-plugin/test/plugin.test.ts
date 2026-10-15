import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {compileFunction} from 'node:vm'
import {rolldown, watch, type OutputAsset, type OutputChunk} from 'rolldown'
import {build as tsdownBuild} from 'tsdown'
import {describe, expect, it} from 'vitest'
import {
  cssShimDtsSource,
  cssShimSource,
  esbuildTargetToLightningCSS,
  pandaCssPlugin,
  withCssCustomExports,
} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const basicFixtureDir = path.join(__dirname, 'fixtures/basic')
const basicEntry = path.join(basicFixtureDir, 'src/index.ts')

function createTempProjectDir(prefix: string): string {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), prefix))
  mkdirSync(path.join(tmpDir, 'src'), {recursive: true})
  symlinkSync(
    path.resolve(__dirname, '../node_modules'),
    path.join(tmpDir, 'node_modules'),
    'junction',
  )
  return tmpDir
}

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
  it('declares @pandacss/compiler and @pandacss/transformer as dependencies, optional @pandacss/dev peer, and matching node engines', () => {
    const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))
    expect(pkg.dependencies).toMatchObject({
      '@pandacss/compiler': expect.any(String),
      '@pandacss/transformer': expect.any(String),
      'browserslist': expect.any(String),
      'lightningcss': expect.any(String),
    })
    expect(pkg.peerDependencies).toEqual({
      '@pandacss/dev': '*',
      'tsdown': '^0.23.0',
    })
    expect(pkg.peerDependenciesMeta).toEqual({
      '@pandacss/dev': {optional: true},
    })
    expect(pkg.engines).toEqual({
      node: '^22.18.0 || ^24.11.0 || >=26.0.0',
    })
  })

  it('extracts Panda CSS into styles.css, transforms css({...}) calls by default, and only emits shims when exports or inject are enabled', async () => {
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
    expect(shimJs).toBeUndefined()
    expect(shimDts).toBeUndefined()

    const entryChunk = output.find(
      (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
    )
    expect(entryChunk).toBeDefined()
    expect(entryChunk!.code).toContain('color_brand')
    expect(entryChunk!.code).toContain('padding_sm')
    expect(entryChunk!.code).not.toContain('createCss')
    expect(entryChunk!.code).not.toContain('@fixtures/pandacss-basic/styles.css')
  })

  it('emits comment-only CJS-safe styles-css.js shim and export {} in styles-css.d.ts when exports: {nodeCompat: true}', async () => {
    expect(cssShimSource).not.toContain('export {}')
    expect(cssShimSource.replaceAll(/^\/\/[^\n]*$/gm, '').trim()).toBe('')
    expect(cssShimDtsSource).toContain('export {}')

    // Verify cssShimSource executes cleanly in CommonJS via compileFunction
    expect(() =>
      compileFunction(cssShimSource, ['require', 'module', 'exports'])(
        () => ({}),
        {exports: {}},
        {},
      ),
    ).not.toThrow()

    const build = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [
        pandaCssPlugin({
          cwd: basicFixtureDir,
          exports: {nodeCompat: true},
        }),
      ],
    })

    const {output} = await build.generate({format: 'esm'})
    await build.close()

    const shimJs = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'styles-css.js',
    )
    const shimDts = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'styles-css.d.ts',
    )
    expect(shimJs).toBeDefined()
    expect(String(shimJs!.source)).toBe(cssShimSource)
    expect(shimDts).toBeDefined()
    expect(String(shimDts!.source)).toBe(cssShimDtsSource)
  })

  it('does not emit shims when exports: false is passed', async () => {
    const build = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [
        pandaCssPlugin({
          cwd: basicFixtureDir,
          exports: false,
        }),
      ],
    })

    const {output} = await build.generate({format: 'esm'})
    await build.close()

    const shimJs = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'styles-css.js',
    )
    const shimDts = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'styles-css.d.ts',
    )
    expect(shimJs).toBeUndefined()
    expect(shimDts).toBeUndefined()
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

  it('injects CSS side-effect import when inject: true and skips .d.ts chunks', async () => {
    const plugin = pandaCssPlugin({
      cwd: basicFixtureDir,
      packageName: '@fixtures/pandacss-basic',
      inject: true,
    })

    const build = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      external: ['@fixtures/pandacss-basic/styles.css'],
      plugins: [plugin],
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

    // Verify renderChunk skips chunks whose name ends in `.d` or whose fileName matches /\.d\.[cm]?ts$/
    const renderChunkHook =
      typeof plugin.renderChunk === 'function' ? plugin.renderChunk : plugin.renderChunk?.handler
    expect(renderChunkHook).toBeDefined()

    const dNameResult = await renderChunkHook!.call(
      {} as never,
      'export declare const cardClass: string;\n',
      {
        type: 'chunk',
        isEntry: true,
        name: 'index.d',
        fileName: 'index.js',
        moduleIds: [basicEntry],
        imports: [],
        dynamicImports: [],
      } as never,
      {format: 'es'} as never,
      {chunks: {}} as never,
    )
    expect(dNameResult).toBeNull()

    const dtsFileResult = await renderChunkHook!.call(
      {} as never,
      'export declare const cardClass: string;\n',
      {
        type: 'chunk',
        isEntry: true,
        name: 'index',
        fileName: 'index.d.mts',
        moduleIds: [basicEntry],
        imports: [],
        dynamicImports: [],
      } as never,
      {format: 'es'} as never,
      {chunks: {}} as never,
    )
    expect(dtsFileResult).toBeNull()
  })

  it('injects CJS require() after the directive prologue and hashbang, preserving strict mode', async () => {
    const tmpDir = createTempProjectDir('panda-cjs-strict-')
    try {
      writeFileSync(
        path.join(tmpDir, 'panda.config.ts'),
        `import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  preflight: false,
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  theme: {extend: {tokens: {colors: {brand: {value: 'rgb(1, 2, 3)'}}}}},
} satisfies Config)
`,
      )
      writeFileSync(
        path.join(tmpDir, 'src/index.ts'),
        `#!/usr/bin/env node
import {css} from '../styled-system/css/index.js'

export const cls = css({color: 'brand'})

export function getReceiver() {
  return this
}
`,
      )

      const build = await rolldown({
        cwd: tmpDir,
        input: path.join(tmpDir, 'src/index.ts'),
        plugins: [
          pandaCssPlugin({
            cwd: tmpDir,
            inject: {nodeCompat: false},
          }),
        ],
      })

      const {output} = await build.generate({format: 'cjs', strict: true, sourcemap: true})
      await build.close()

      const entryChunk = output.find(
        (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
      )
      expect(entryChunk).toBeDefined()
      expect(entryChunk!.map).toBeTruthy()
      expect(entryChunk!.code).toMatch(
        /^#!\/usr\/bin\/env node\n"use strict";\nrequire\("\.\/styles\.css"\);\n/,
      )

      // Strip the hashbang line for compileFunction and verify actual strict-mode runtime behavior
      const executableCode = entryChunk!.code.replace(/^#![^\n]*\n/, '')
      const requiredIds: string[] = []
      const mod: {exports: Record<string, unknown>} = {exports: {}}
      const customRequire = (id: string) => {
        requiredIds.push(id)
        return {}
      }
      Reflect.apply(compileFunction(executableCode, ['require', 'module', 'exports']), undefined, [
        customRequire,
        mod,
        mod.exports,
      ])
      expect(requiredIds).toEqual(['./styles.css'])
      const getReceiver = mod.exports['getReceiver']
      expect(typeof getReceiver).toBe('function')
      expect((getReceiver as () => unknown)()).toBeUndefined()
    } finally {
      rmSync(tmpDir, {recursive: true, force: true})
    }
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

    const secondBuild = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [pandaCssPlugin({cwd: basicFixtureDir})],
    })
    await secondBuild.generate({format: 'esm'})
    await secondBuild.close()

    expect(snapshotMtimes(styledSystemDir)).toEqual(beforeMtimes)

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

  it('derives source filtering from panda.config.ts include/exclude while keeping plugin.transform unfiltered for watch reloads', async () => {
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
      expect(withGlobsPlugin.transform.filter).toBeUndefined()
      expect(withGlobsPlugin.transform.handler).toEqual(expect.any(Function))
    }

    const tmpDir = createTempProjectDir('panda-no-globs-')
    try {
      writeFileSync(
        path.join(tmpDir, 'panda.config.ts'),
        `import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  preflight: false,
  outdir: 'styled-system',
  theme: {extend: {tokens: {colors: {brand: {value: 'rgb(1, 2, 3)'}}}}},
} satisfies Config)
`,
      )
      writeFileSync(
        path.join(tmpDir, 'src/index.ts'),
        `import {css} from '../styled-system/css/index.js'
export const x = css({color: 'brand'})
`,
      )

      const withoutGlobsPlugin = pandaCssPlugin({cwd: tmpDir})
      const buildWithoutGlobs = await rolldown({
        cwd: tmpDir,
        input: path.join(tmpDir, 'src/index.ts'),
        plugins: [withoutGlobsPlugin],
      })
      const {output} = await buildWithoutGlobs.generate({format: 'esm'})
      await buildWithoutGlobs.close()

      expect(typeof withoutGlobsPlugin.transform).toBe('object')
      if (
        typeof withoutGlobsPlugin.transform === 'object' &&
        withoutGlobsPlugin.transform !== null
      ) {
        expect(withoutGlobsPlugin.transform.filter).toBeUndefined()
      }
      const entryChunk = output.find(
        (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
      )
      expect(entryChunk?.code).toContain('color_brand')
    } finally {
      rmSync(tmpDir, {recursive: true, force: true})
    }
  })

  it('re-transforms newly eligible modules when include/exclude is widened in a persistent rolldown watcher', async () => {
    const tmpDir = createTempProjectDir('panda-persistent-watch-')
    try {
      const configPath = path.join(tmpDir, 'panda.config.ts')
      const entryPath = path.join(tmpDir, 'src/index.ts')
      const outDir = path.join(tmpDir, 'dist')

      const writeConfig = (excludeLine: string) =>
        writeFileSync(
          configPath,
          `import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  preflight: false,
  include: ['./src/**/*.ts'],
  ${excludeLine}
  outdir: 'styled-system',
  theme: {
    extend: {
      tokens: {
        colors: {
          brand: {value: 'rgb(1, 2, 3)'},
        },
      },
    },
  },
} satisfies Config)
`,
        )

      // Start with src/index.ts excluded
      writeConfig(`exclude: ['./src/index.ts'],`)
      writeFileSync(
        entryPath,
        `import {css} from '../styled-system/css/index.js'
export const badge = css({color: 'brand'})
`,
      )

      let buildCount = 0
      let resolveFirstBuild!: () => void
      let resolveSecondBuild!: () => void
      const firstBuildDone = new Promise<void>((resolve) => {
        resolveFirstBuild = resolve
      })
      const secondBuildDone = new Promise<void>((resolve) => {
        resolveSecondBuild = resolve
      })

      const watcher = watch({
        cwd: tmpDir,
        input: entryPath,
        external: ['./styles.css'],
        output: {
          dir: outDir,
          format: 'esm',
        },
        plugins: [pandaCssPlugin({cwd: tmpDir, inject: true})],
      })

      watcher.on('event', (event) => {
        if (event.code === 'BUNDLE_END') {
          void event.result.close()
          buildCount += 1
          if (buildCount === 1) resolveFirstBuild()
          if (buildCount >= 2) resolveSecondBuild()
        }
      })

      try {
        await firstBuildDone
        const firstJs = readFileSync(path.join(outDir, 'index.js'), 'utf8')
        expect(firstJs).not.toContain('import "./styles.css";')
        expect(firstJs).toContain('createCss')

        // Now widen the config by removing the exclusion on src/index.ts
        writeConfig(`exclude: [],`)
        await secondBuildDone

        const secondJs = readFileSync(path.join(outDir, 'index.js'), 'utf8')
        expect(secondJs).toContain('import "./styles.css";')
        expect(secondJs).toContain('color_brand')
        expect(secondJs).not.toContain('createCss')
        expect(readFileSync(path.join(outDir, 'styles.css'), 'utf8')).toContain('#010203')
      } finally {
        await watcher.close()
      }
    } finally {
      rmSync(tmpDir, {recursive: true, force: true})
    }
  })

  it('watches config dependencies and reloads driver, filters, and codegen on watchChange', async () => {
    const tmpDir = createTempProjectDir('panda-watch-reload-')
    try {
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
          `import {defineConfig, type Config} from '@pandacss/dev'
import {brandColor, extraTokens} from './tokens.ts'

export default defineConfig({
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
} satisfies Config)
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

      writeTokens('rgb(4, 5, 6)', 'accent: {value: "rgb(7, 8, 9)"}')
      const watchChangeHook =
        typeof plugin.watchChange === 'function' ? plugin.watchChange : plugin.watchChange?.handler
      await watchChangeHook?.call({} as never, tokensPath, {event: 'update'})

      const second = await runBuild()
      expect(second.css).toContain('#040506')
      expect(second.css).not.toContain('#010203')
      expect(readFileSync(path.join(tmpDir, 'styled-system/types/tokens.d.ts'), 'utf8')).toContain(
        '"accent"',
      )

      writeConfig(`exclude: ['./src/index.ts'],`)
      await watchChangeHook?.call({} as never, configPath, {event: 'update'})

      const third = await runBuild()
      expect(third.code).not.toContain('./styles.css')
    } finally {
      rmSync(tmpDir, {recursive: true, force: true})
    }
  })

  it('converts esbuild targets (including edge) and browserslist queries while skipping ES versions and node', () => {
    const edgeTargets = esbuildTargetToLightningCSS('edge100')
    expect(edgeTargets).toBeDefined()
    expect(edgeTargets?.edge).toBe(100 << 16)

    const mixedTargets = esbuildTargetToLightningCSS([
      'chrome102',
      'edge105',
      'node22',
      'deno2',
      'hermes0.13',
      'rhino1.7',
      'es2022',
    ])
    expect(mixedTargets).toBeDefined()
    expect(mixedTargets?.chrome).toBe(102 << 16)
    expect(mixedTargets?.edge).toBe(105 << 16)

    expect(esbuildTargetToLightningCSS(['chrome61', 'chrome120'])?.chrome).toBe(61 << 16)
    expect(esbuildTargetToLightningCSS(['chrome120', 'chrome61'])?.chrome).toBe(61 << 16)

    expect(
      esbuildTargetToLightningCSS([
        'node22',
        'deno2',
        'hermes0.13',
        'rhino1.7',
        'es2022',
        'esnext',
      ]),
    ).toBeUndefined()
    expect(esbuildTargetToLightningCSS('defaults')).toBeDefined()
  })

  it('configures package.json exports via withCssCustomExports, upgrading pre-existing tsdown CSS entries and resolving custom outDir', async () => {
    const exportsConfig = withCssCustomExports(true, 'styles.css', {nodeCompat: true}, './lib')

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

    const pkgRoot = '/workspace/packages/my-lib'
    const result = await exportsConfig.customExports(
      // tsdown 0.23.1 pre-populates `./styles.css` before calling `customExports`
      {'.': './lib/index.js', './styles.css': './lib/styles.css'},
      {
        pkg: {
          name: '@fixtures/pandacss-basic',
          packageJsonPath: path.join(pkgRoot, 'package.json'),
        } as never,
        chunks: {
          es: [
            {
              type: 'asset',
              fileName: 'styles.css',
              outDir: path.join(pkgRoot, 'lib'),
            } as never,
          ],
        },
        isPublish: true,
      },
    )

    expect(result).toEqual({
      '.': './lib/index.js',
      './styles.css': {
        types: './lib/styles-css.d.ts',
        style: './lib/styles.css',
        browser: './lib/styles.css',
        module: './lib/styles.css',
        node: {
          types: './lib/styles-css.d.ts',
          default: './lib/styles-css.js',
        },
        default: './lib/styles.css',
      },
    })
  })

  it('upgrades tsdown 0.23.1 auto-generated CSS export to conditional Node shim in a real tsdown build with custom outDir', async () => {
    const tmpDir = createTempProjectDir('panda-tsdown-build-')
    try {
      const pkgJsonPath = path.join(tmpDir, 'package.json')
      writeFileSync(
        pkgJsonPath,
        JSON.stringify(
          {
            name: '@fixtures/panda-tsdown-real',
            version: '1.0.0',
            type: 'module',
            imports: {
              '#styled-system/*': './styled-system/*/index.js',
            },
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(tmpDir, 'panda.config.ts'),
        `import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  preflight: false,
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  importMap: '#styled-system',
  theme: {extend: {tokens: {colors: {brand: {value: 'rgb(1, 2, 3)'}}}}},
} satisfies Config)
`,
      )
      writeFileSync(
        path.join(tmpDir, 'src/index.ts'),
        `import {css} from '#styled-system/css'
export const brandClass = css({color: 'brand'})
`,
      )

      await tsdownBuild({
        cwd: tmpDir,
        entry: ['src/index.ts'],
        outDir: './lib',
        dts: false,
        clean: true,
        exports: true,
        logLevel: 'silent',
        plugins: [
          pandaCssPlugin({
            cwd: tmpDir,
            inject: true,
            exports: {nodeCompat: true},
          }),
        ],
      })

      const writtenPkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
      expect(writtenPkg.exports['./styles.css']).toEqual({
        types: './lib/styles-css.d.ts',
        style: './lib/styles.css',
        browser: './lib/styles.css',
        module: './lib/styles.css',
        node: {
          types: './lib/styles-css.d.ts',
          default: './lib/styles-css.js',
        },
        default: './lib/styles.css',
      })
      expect(existsSync(path.join(tmpDir, 'lib/styles.css'))).toBe(true)
      expect(existsSync(path.join(tmpDir, 'lib/styles-css.js'))).toBe(true)
      expect(existsSync(path.join(tmpDir, 'lib/styles-css.d.ts'))).toBe(true)
    } finally {
      rmSync(tmpDir, {recursive: true, force: true})
    }
  })

  it('runs codegen before tsdown CJS + dts build and does not inject CSS import into .d.cts', async () => {
    const tmpDir = createTempProjectDir('panda-tsdown-cjs-dts-')
    try {
      writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify(
          {
            name: '@fixtures/panda-tsdown-cjs-dts',
            version: '1.0.0',
            type: 'module',
            types: './dist/index.d.cts',
            imports: {
              '#styled-system/*': './styled-system/*/index.js',
            },
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(tmpDir, 'tsconfig.json'),
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'Preserve',
              moduleResolution: 'Bundler',
              strict: true,
              declaration: true,
              skipLibCheck: true,
            },
            include: ['src', 'styled-system'],
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(tmpDir, 'panda.config.ts'),
        `import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  preflight: false,
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  importMap: '#styled-system',
  theme: {extend: {tokens: {colors: {brand: {value: 'rgb(1, 2, 3)'}}}}},
} satisfies Config)
`,
      )
      writeFileSync(
        path.join(tmpDir, 'src/index.ts'),
        `import {css} from '#styled-system/css'
import type {SystemStyleObject} from '#styled-system/types'

export function makeBrandBox(overrides?: SystemStyleObject): string {
  return css({color: 'brand'}, overrides)
}
`,
      )

      // styled-system/ does not exist before tsdownBuild runs
      expect(existsSync(path.join(tmpDir, 'styled-system'))).toBe(false)

      await tsdownBuild({
        cwd: tmpDir,
        entry: ['src/index.ts'],
        format: 'cjs',
        tsconfig: path.join(tmpDir, 'tsconfig.json'),
        dts: true,
        clean: true,
        exports: true,
        logLevel: 'silent',
        deps: {
          neverBundle: ['@fixtures/panda-tsdown-cjs-dts/styles.css'],
        },
        plugins: [
          pandaCssPlugin({
            cwd: tmpDir,
            inject: true,
            exports: {nodeCompat: true},
          }),
        ],
      })

      const cjsCode = readFileSync(path.join(tmpDir, 'dist/index.cjs'), 'utf8')
      expect(cjsCode).toContain('require("@fixtures/panda-tsdown-cjs-dts/styles.css");')

      const dctsCode = readFileSync(path.join(tmpDir, 'dist/index.d.cts'), 'utf8')
      expect(dctsCode).toContain('SystemStyleObject')
      expect(dctsCode).not.toContain('styles.css')
    } finally {
      rmSync(tmpDir, {recursive: true, force: true})
    }
  })

  it('uses relative CSS import for standalone inject: true without CSS export, and bare import when package.json exports ./styles.css', async () => {
    // basicFixtureDir has name "@fixtures/pandacss-basic" but no exports["./styles.css"]
    const relativeBuild = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      external: ['./styles.css'],
      plugins: [
        pandaCssPlugin({
          cwd: basicFixtureDir,
          inject: true,
        }),
      ],
    })
    const {output: relativeOutput} = await relativeBuild.generate({format: 'esm'})
    await relativeBuild.close()

    const relativeEntry = relativeOutput.find(
      (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
    )
    expect(relativeEntry?.code.startsWith('import "./styles.css";\n')).toBe(true)

    // When package.json manually defines exports["./styles.css"], standalone inject: true uses the bare specifier
    const tmpDir = createTempProjectDir('panda-manual-exports-')
    try {
      writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify(
          {
            name: '@fixtures/panda-manual-exports',
            version: '1.0.0',
            type: 'module',
            exports: {
              '.': './dist/index.js',
              './styles.css': './dist/styles.css',
            },
            imports: {
              '#styled-system/*': './styled-system/*/index.js',
            },
          },
          null,
          2,
        ),
      )
      writeFileSync(
        path.join(tmpDir, 'panda.config.ts'),
        `import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  preflight: false,
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
  importMap: '#styled-system',
  theme: {extend: {tokens: {colors: {brand: {value: 'rgb(1, 2, 3)'}}}}},
} satisfies Config)
`,
      )
      writeFileSync(
        path.join(tmpDir, 'src/index.ts'),
        `import {css} from '#styled-system/css'
export const c = css({color: 'brand'})
`,
      )

      const manualBuild = await rolldown({
        cwd: tmpDir,
        input: path.join(tmpDir, 'src/index.ts'),
        external: ['@fixtures/panda-manual-exports/styles.css'],
        plugins: [
          pandaCssPlugin({
            cwd: tmpDir,
            inject: true,
          }),
        ],
      })
      const {output: manualOutput} = await manualBuild.generate({format: 'esm'})
      await manualBuild.close()

      const manualEntry = manualOutput.find(
        (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
      )
      expect(
        manualEntry?.code.startsWith('import "@fixtures/panda-manual-exports/styles.css";\n'),
      ).toBe(true)
    } finally {
      rmSync(tmpDir, {recursive: true, force: true})
    }
  })

  it('transforms and tracks parent-relative include globs such as ../shared/**/*.ts', async () => {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'panda-parent-rel-'))
    try {
      const pkgDir = path.join(rootDir, 'pkg')
      const sharedDir = path.join(rootDir, 'shared')
      mkdirSync(path.join(pkgDir, 'src'), {recursive: true})
      mkdirSync(sharedDir, {recursive: true})
      symlinkSync(
        path.resolve(__dirname, '../node_modules'),
        path.join(rootDir, 'node_modules'),
        'junction',
      )

      writeFileSync(
        path.join(pkgDir, 'panda.config.ts'),
        `import {defineConfig, type Config} from '@pandacss/dev'

export default defineConfig({
  preflight: false,
  include: ['./src/**/*.ts', '../shared/**/*.ts'],
  outdir: 'styled-system',
  theme: {extend: {tokens: {colors: {brand: {value: 'rgb(1, 2, 3)'}}}}},
} satisfies Config)
`,
      )
      writeFileSync(
        path.join(sharedDir, 'card.ts'),
        `import {css} from '../pkg/styled-system/css/index.js'
export const sharedCard = css({color: 'brand'})
`,
      )
      writeFileSync(
        path.join(pkgDir, 'src/index.ts'),
        `export {sharedCard} from '../../shared/card.ts'
`,
      )

      const build = await rolldown({
        cwd: pkgDir,
        input: path.join(pkgDir, 'src/index.ts'),
        external: ['./styles.css'],
        plugins: [
          pandaCssPlugin({
            cwd: pkgDir,
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
      expect(entryChunk!.code.startsWith('import "./styles.css";\n')).toBe(true)
      expect(entryChunk!.code).toContain('color_brand')
      expect(entryChunk!.code).not.toContain('createCss')
    } finally {
      rmSync(rootDir, {recursive: true, force: true})
    }
  })

  it('forces cssModules: false in lightningcss so Panda class names are not renamed', async () => {
    const build = await rolldown({
      cwd: basicFixtureDir,
      input: basicEntry,
      plugins: [
        pandaCssPlugin({
          cwd: basicFixtureDir,
          lightningcss: {cssModules: true},
        }),
      ],
    })

    const {output} = await build.generate({format: 'esm'})
    await build.close()

    const cssAsset = output.find(
      (item): item is OutputAsset => item.type === 'asset' && item.fileName === 'styles.css',
    )
    const entryChunk = output.find(
      (item): item is OutputChunk => item.type === 'chunk' && item.isEntry,
    )
    expect(cssAsset).toBeDefined()
    expect(entryChunk).toBeDefined()
    expect(String(cssAsset!.source)).toContain('.color_brand')
    expect(String(cssAsset!.source)).toContain('.padding_sm')
    expect(entryChunk!.code).toContain('color_brand')
    expect(entryChunk!.code).toContain('padding_sm')
  })
})
