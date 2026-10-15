import {
  existsSync,
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
import type {ResolvedConfig, UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {pandacssPlugin, type Options} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/basic')
const fixtureEntry = path.join(fixtureDir, 'src/index.ts')

function findAsset(output: readonly (OutputAsset | OutputChunk)[], fileName: string): string {
  const asset = output.find((assetOrChunk) => assetOrChunk.fileName === fileName)
  if (!asset || asset.type !== 'asset') {
    expect.unreachable(`expected an emitted \`${fileName}\` asset`)
  }
  const {source} = asset
  return typeof source === 'string' ? source : new TextDecoder().decode(source)
}

function findEntryChunk(output: readonly (OutputAsset | OutputChunk)[]): OutputChunk {
  const chunk = output.find((assetOrChunk) => assetOrChunk.type === 'chunk' && assetOrChunk.isEntry)
  if (!chunk || chunk.type !== 'chunk') {
    expect.unreachable('expected an entry chunk')
  }
  return chunk
}

async function generate(
  options: Options,
  format: 'esm' | 'cjs' = 'esm',
): Promise<readonly (OutputAsset | OutputChunk)[]> {
  const bundle = await rolldown({
    cwd: fixtureDir,
    input: fixtureEntry,
    plugins: [pandacssPlugin(options)],
  })
  try {
    const {output} = await bundle.generate({format})
    return output
  } finally {
    await bundle.close()
  }
}

describe('pandacssPlugin', () => {
  test('rewrites the style calls into class names and extracts the stylesheet', async () => {
    const output = await generate({cwd: fixtureDir, target: 'chrome61'})

    const entry = findEntryChunk(output)
    // The `css()` calls are gone, and with them the import of Panda's runtime
    expect(entry.code).toContain('const brandText = "color_brand"')
    expect(entry.code).toContain('const overlay = "display_flex inset_0"')
    expect(entry.code).not.toContain('styled-system')
    expect(entry.code).not.toMatch(/\bcss\(/)

    const css = findAsset(output, 'bundle.css')
    expect(css).toContain('--colors-brand: #f03e2f')
    expect(css).toContain('color: var(--colors-brand)')
    // lightningcss normalized the `rgb(1, 2, 3)` marker
    expect(css).toContain('#010203')
    // chrome61 predates the `inset` shorthand, so it is flattened into `top`/`right`/…
    expect(css).not.toContain('inset:')
    expect(css).toContain('top: 0')
    // Minification is opt-in
    expect(css).toContain('\n')
  })

  test('drops the `--made-with-panda` marker and the layers that leaves empty', async () => {
    const output = await generate({cwd: fixtureDir})
    const css = findAsset(output, 'bundle.css')

    expect(css).not.toContain('--made-with-panda')
    // No `@layer reset, base, …;` declaration, and no `@layer base;` statement left behind by
    // the emptied `base` layer either: only the layers with rules, as blocks
    expect(css).not.toMatch(/@layer\s+[^{};]+;/)
    expect(css).not.toContain('@layer base')
    expect(css).not.toContain('@layer reset')
    expect(css).not.toContain('@layer recipes')
    expect(css).toContain('@layer tokens {')
    expect(css).toContain('@layer utilities {')
  })

  test('derives the `transform` hook filter from the config `include`/`exclude` globs', async () => {
    const plugin = pandacssPlugin({cwd: fixtureDir})
    expect(plugin.transform).toEqual({handler: expect.any(Function)})

    const bundle = await rolldown({cwd: fixtureDir, input: fixtureEntry, plugins: [plugin]})
    try {
      // The config is loaded in the `options` hook, so the filter is in place before rolldown
      // reads the plugin's hooks
      expect(plugin.transform).toEqual({
        filter: {
          id: {
            include: [expect.any(RegExp)],
            exclude: [expect.any(RegExp), expect.any(RegExp)],
          },
        },
        handler: expect.any(Function),
      })
      const {transform} = plugin
      if (typeof transform !== 'object' || !transform.filter || Array.isArray(transform.filter)) {
        expect.unreachable('expected an object hook with a `HookFilter`')
      }
      const {id} = transform.filter
      if (typeof id !== 'object' || id === null || id instanceof RegExp || Array.isArray(id)) {
        expect.unreachable('expected an `include`/`exclude` id filter')
      }
      const [include] = Array.isArray(id.include) ? id.include : [id.include]
      const [, exclude] = Array.isArray(id.exclude) ? id.exclude : [id.exclude]
      if (!(include instanceof RegExp) || !(exclude instanceof RegExp)) {
        expect.unreachable('expected the globs to be converted to RegExps')
      }
      // The globs are resolved against `cwd` and tested against POSIX ids, like rolldown does
      // for RegExp filters on every OS
      const posixFixtureDir = fixtureDir.replaceAll('\\', '/')
      expect(include.test(`${posixFixtureDir}/src/index.ts`)).toBe(true)
      expect(include.test(`${posixFixtureDir}/src/nested/deep/styles.css.ts`)).toBe(true)
      expect(include.test(`${posixFixtureDir}/src/index.tsx`)).toBe(false)
      expect(include.test(`${posixFixtureDir}/other/index.ts`)).toBe(false)
      expect(include.test(`${posixFixtureDir}/src/index.ts?query`)).toBe(true)
      expect(exclude.test(`${posixFixtureDir}/src/index.test.ts`)).toBe(true)
      expect(exclude.test(`${posixFixtureDir}/src/index.ts`)).toBe(false)

      const {output} = await bundle.generate({format: 'esm'})
      expect(findEntryChunk(output).code).toContain('"color_brand"')
    } finally {
      await bundle.close()
    }
  })

  test('`minify: true` minifies the stylesheet', async () => {
    const output = await generate({cwd: fixtureDir, minify: true})
    const css = findAsset(output, 'bundle.css')
    expect(css).toContain('@layer tokens{:where(:root,:host){--colors-brand:#f03e2f}}')
    expect(css.trim()).not.toContain('\n')
  })

  test('`transform: false` only extracts the stylesheet', async () => {
    const output = await generate({cwd: fixtureDir, transform: false, inject: true})
    const entry = findEntryChunk(output)
    // The runtime `css()` calls stay (and bundle Panda's runtime through the `imports` map)
    expect(entry.code).toMatch(/\bcss\(/)
    expect(entry.code).not.toContain('"color_brand"')
    // The modules still count as styled for `inject`
    expect(entry.code).toContain('import "./bundle.css";')
    expect(findAsset(output, 'bundle.css')).toContain('color: var(--colors-brand)')
  })

  test('`inject` prepends a relative CSS import, or a `require()` in CJS output', async () => {
    const esm = await generate({cwd: fixtureDir, inject: true})
    expect(findEntryChunk(esm).code.startsWith('import "./bundle.css";\n')).toBe(true)

    const cjs = await generate({cwd: fixtureDir, inject: true}, 'cjs')
    expect(findEntryChunk(cjs).code.startsWith('require("./bundle.css");\n')).toBe(true)

    // Nothing is injected (and no CSS file is emitted) without `inject`/`exports`
    const plain = await generate({cwd: fixtureDir})
    expect(findEntryChunk(plain).code).not.toContain('bundle.css')
  })

  test('`exports.nodeCompat` emits the shims and injects the self-referential import', async () => {
    const output = await generate({cwd: fixtureDir, inject: true, exports: {nodeCompat: true}})

    expect(findEntryChunk(output).code).toContain('import "@fixtures/panda-basic/bundle.css";')
    expect(findAsset(output, 'bundle-css.js')).toContain('No-op shim for `bundle.css`')
    expect(findAsset(output, 'bundle-css.d.ts')).toContain('export {}')
  })

  test("`tsdownConfigResolved` forwards tsdown's package name, `target` and `cwd`", async () => {
    // The self-referential import of `exports` uses the package name tsdown resolved, the CSS
    // syntax lowering target defaults to tsdown's resolved top-level `target`, and the Panda
    // config is discovered from tsdown's `cwd`
    const plugin = pandacssPlugin({inject: true, exports: {nodeCompat: true}})
    await plugin.tsdownConfigResolved?.({
      target: ['chrome61'],
      pkg: {name: '@fixtures/host-library'},
      cwd: fixtureDir,
    } as Partial<ResolvedConfig> as ResolvedConfig)

    const bundle = await rolldown({input: fixtureEntry, plugins: [plugin]})
    try {
      const {output} = await bundle.generate({format: 'esm'})
      expect(findEntryChunk(output).code).toContain('import "@fixtures/host-library/bundle.css";')

      const css = findAsset(output, 'bundle.css')
      expect(css).not.toContain('inset:')
      expect(css).toContain('top: 0')
    } finally {
      await bundle.close()
    }
  })

  test('leaves the calls it cannot resolve statically to the runtime, with a warning', async () => {
    const dynamicFixtureDir = path.resolve(__dirname, 'fixtures/dynamic')
    const warnings: string[] = []
    const bundle = await rolldown({
      cwd: dynamicFixtureDir,
      input: path.join(dynamicFixtureDir, 'src/index.ts'),
      plugins: [pandacssPlugin({cwd: dynamicFixtureDir, inject: true})],
      onLog(level, log) {
        if (level === 'warn') warnings.push(log.message)
      },
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      const entry = findEntryChunk(output)

      // The conditional composition is resolved statically …
      expect(entry.code).toContain('"display_flex" + (active ? " color_brand" : "")')
      // … while the call with a dynamic value stays, running through Panda's runtime, which
      // rolldown bundles from the `styled-system` directory
      expect(entry.code).toMatch(/css\(\{\s*color\s*\}\)/)
      expect(
        entry.moduleIds.some((id) => id.replaceAll('\\', '/').includes('/styled-system/css/')),
      ).toBe(true)
      // The module still counts as styled for `inject`
      expect(entry.code).toContain('import "./bundle.css";')

      // Panda's diagnostic is reported once, although both the parse and the transform of the
      // module carry it
      const unextractable = warnings.filter(
        (message) =>
          message.includes('received a dynamic argument') && /src[\\/]index\.ts:/.test(message),
      )
      expect(unextractable).toHaveLength(1)
      expect(unextractable[0]).toContain('[pandacss] Panda reported a warning while parsing')
      expect(unextractable[0]).toMatch(/src[\\/]index\.ts:11:/)
    } finally {
      await bundle.close()
    }
  })

  test('injects the CSS import for modules whose style calls are all left to the runtime', async () => {
    // Panda extracts nothing from a module with only dynamic values (the parse reports no
    // calls, just the `panda_call_unextractable` diagnostic) and the transformer leaves it
    // unchanged — but its runtime calls still produce Panda class names, so the stylesheet
    // must still reach the entry chunks importing it
    const dynamicFixtureDir = path.resolve(__dirname, 'fixtures/dynamic')
    const warnings: string[] = []
    const bundle = await rolldown({
      cwd: dynamicFixtureDir,
      input: path.join(dynamicFixtureDir, 'src/only-dynamic.ts'),
      plugins: [pandacssPlugin({cwd: dynamicFixtureDir, inject: true})],
      onLog(level, log) {
        if (level === 'warn') warnings.push(log.message)
      },
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      const entry = findEntryChunk(output)

      expect(entry.code.startsWith('import "./bundle.css";\n')).toBe(true)
      expect(entry.code).toMatch(/css\(\{\s*color\s*\}\)/)
      expect(
        entry.moduleIds.some((id) => id.replaceAll('\\', '/').includes('/styled-system/css/')),
      ).toBe(true)
      expect(
        warnings.filter(
          (message) =>
            message.includes('received a dynamic argument') &&
            /src[\\/]only-dynamic\.ts:/.test(message),
        ),
      ).toHaveLength(1)
    } finally {
      await bundle.close()
    }
  })

  test('`lightningcss.targets` wins over `target`, and `target: false` skips lowering', async () => {
    const lowered = await generate({
      cwd: fixtureDir,
      target: 'chrome120',
      lightningcss: {targets: {chrome: 61 << 16}},
    })
    expect(findAsset(lowered, 'bundle.css')).not.toContain('inset:')

    const raw = await generate({cwd: fixtureDir, target: false})
    expect(findAsset(raw, 'bundle.css')).toContain('inset: 0')
  })
})

/** The modification times of every file in a directory tree, keyed by path. */
function snapshotMtimes(dir: string): Map<string, number> {
  const mtimes = new Map<string, number>()
  for (const entry of readdirSync(dir, {withFileTypes: true, recursive: true})) {
    if (!entry.isFile()) continue
    const filePath = path.join(entry.parentPath, entry.name)
    mtimes.set(filePath, statSync(filePath).mtimeMs)
  }
  return mtimes
}

describe('codegen', () => {
  const codegenFixtureDir = path.resolve(__dirname, 'fixtures/codegen')
  const styledSystemDir = path.join(codegenFixtureDir, 'styled-system')
  const runtimeFile = path.join(styledSystemDir, 'css/index.js')
  const typesFile = path.join(styledSystemDir, 'css/css.d.ts')

  async function build(options: Options): Promise<OutputChunk> {
    const bundle = await rolldown({
      cwd: codegenFixtureDir,
      input: path.join(codegenFixtureDir, 'src/index.ts'),
      plugins: [pandacssPlugin({cwd: codegenFixtureDir, ...options})],
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      return findEntryChunk(output)
    } finally {
      await bundle.close()
    }
  }

  test('regenerates stale and missing `styled-system` artifacts before the build', async () => {
    const generated = readFileSync(runtimeFile, 'utf-8')
    writeFileSync(runtimeFile, '// stale\n')
    rmSync(typesFile)

    // `transform: false` bundles the runtime, so the output proves the codegen ran before
    // rolldown loaded it
    const entry = await build({transform: false})
    expect(entry.code).not.toContain('// stale')
    expect(readFileSync(runtimeFile, 'utf-8')).toBe(generated)
    expect(existsSync(typesFile)).toBe(true)
  })

  test('leaves current artifacts untouched', async () => {
    await build({})
    const before = snapshotMtimes(styledSystemDir)
    expect(before.size).toBeGreaterThan(0)

    // A second build (tsdown runs one per output format) rewrites nothing: the modification
    // times are unchanged, so nothing downstream (watchers, caches) sees a change
    await build({})
    expect(snapshotMtimes(styledSystemDir)).toEqual(before)
  })

  test('`codegen: false` leaves the artifacts alone', async () => {
    const generated = readFileSync(runtimeFile, 'utf-8')
    writeFileSync(runtimeFile, '// stale\n')
    try {
      await build({codegen: false})
      expect(readFileSync(runtimeFile, 'utf-8')).toBe('// stale\n')
    } finally {
      writeFileSync(runtimeFile, generated)
    }
  })

  test('`outdir` redirects the artifacts, like in `@pandacss/vite`', async () => {
    const outdir = mkdtempSync(path.join(os.tmpdir(), 'pandacss-tsdown-plugin-outdir-'))
    try {
      await build({outdir})
      expect(existsSync(path.join(outdir, 'css/index.js'))).toBe(true)
      expect(existsSync(path.join(outdir, 'css/css.d.ts'))).toBe(true)
    } finally {
      rmSync(outdir, {recursive: true, force: true})
    }
  })
})

const conditionalCssExport = {
  types: './dist/bundle-css.d.ts',
  browser: './dist/bundle.css',
  style: './dist/bundle.css',
  node: './dist/bundle-css.js',
  default: './dist/bundle-css.js',
}

/** Runs the plugin's `tsdownConfig` hook against a tsdown user config, like tsdown does. */
async function runTsdownConfigHook(
  config: UserConfig,
  options: Options = {inject: true, exports: {nodeCompat: true}},
): Promise<UserConfig> {
  const plugin = pandacssPlugin(options)
  expect(typeof plugin.tsdownConfig).toBe('function')
  const result = await plugin.tsdownConfig?.(config, {})
  expect(result).toBeUndefined() // the hook mutates the config in place
  return config
}

/** Resolves the `customExports` function the hook composed into the `exports` option. */
function getCustomExports(config: UserConfig) {
  const exportsOption = config.exports
  if (typeof exportsOption !== 'object' || typeof exportsOption?.customExports !== 'function') {
    expect.unreachable('expected `exports.customExports` to be a function')
  }
  return exportsOption.customExports
}

const customExportsContext = {
  pkg: {packageJsonPath: 'package.json'},
  chunks: [],
  outDir: 'dist',
  isPublish: false,
} as unknown as Parameters<
  Extract<NonNullable<Extract<UserConfig['exports'], object>['customExports']>, Function>
>[1]

describe('tsdownConfig hook', () => {
  test('writes the conditional CSS export through `exports.customExports`', async () => {
    const config = await runTsdownConfigHook({exports: true})
    const customExports = getCustomExports(config)
    await expect(
      customExports(
        {'.': './dist/index.mjs', './package.json': './package.json'},
        customExportsContext,
      ),
    ).resolves.toEqual({
      '.': './dist/index.mjs',
      './bundle.css': conditionalCssExport,
      './package.json': './package.json',
    })
  })

  test('writes a plain CSS export for `exports: true`', async () => {
    const config = await runTsdownConfigHook({exports: true}, {inject: true, exports: true})
    const customExports = getCustomExports(config)
    await expect(customExports({'.': './dist/index.mjs'}, customExportsContext)).resolves.toEqual({
      '.': './dist/index.mjs',
      './bundle.css': './dist/bundle.css',
    })
  })

  test('respects `outDir` and `fileName`', async () => {
    const config = await runTsdownConfigHook(
      {exports: true, outDir: 'lib'},
      {exports: {nodeCompat: true}, fileName: 'styles.css'},
    )
    const customExports = getCustomExports(config)
    await expect(customExports({'.': './lib/index.mjs'}, customExportsContext)).resolves.toEqual({
      '.': './lib/index.mjs',
      './styles.css': {
        types: './lib/styles-css.d.ts',
        browser: './lib/styles.css',
        style: './lib/styles.css',
        node: './lib/styles-css.js',
        default: './lib/styles-css.js',
      },
    })
  })

  test('composes with a pre-existing `customExports`', async () => {
    const config = await runTsdownConfigHook({
      exports: {customExports: (exportsMap) => ({...exportsMap, './extra': './dist/extra.mjs'})},
    })
    const customExports = getCustomExports(config)
    await expect(customExports({'.': './dist/index.mjs'}, customExportsContext)).resolves.toEqual({
      '.': './dist/index.mjs',
      './extra': './dist/extra.mjs',
      './bundle.css': conditionalCssExport,
    })
  })

  test('leaves the config alone without `exports`, or when tsdown `exports` is off', async () => {
    const withoutCssExports = await runTsdownConfigHook({exports: true}, {inject: true})
    expect(withoutCssExports.exports).toBe(true)

    const withoutTsdownExports = await runTsdownConfigHook({})
    expect(withoutTsdownExports.exports).toBeUndefined()
  })
})
