import {mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {
  rolldown,
  type ModuleFormat,
  type OutputAsset,
  type OutputChunk,
  type Plugin,
  type PluginContext,
} from 'rolldown'
import type {ResolvedConfig, TsdownPlugin, UserConfig} from 'tsdown'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {DEFAULT_CSS_FILE_NAME, pandaPlugin, type Options} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/basic')

type Output = readonly (OutputAsset | OutputChunk)[]

interface BuildOptions {
  input?: string | string[]
  format?: ModuleFormat
  /** Runs the `tsdownConfigResolved` hook with this partial config first, like tsdown does. */
  tsdown?: Partial<ResolvedConfig>
}

async function build(
  options: Options = {},
  {input = 'src/index.ts', format = 'esm', tsdown}: BuildOptions = {},
): Promise<Output> {
  const plugin = pandaPlugin({cwd: fixtureDir, ...options})
  if (tsdown) {
    await plugin.tsdownConfigResolved?.({cwd: fixtureDir, ...tsdown} as ResolvedConfig)
  }
  const bundle = await rolldown({
    cwd: fixtureDir,
    input: Array.isArray(input)
      ? input.map((file) => path.join(fixtureDir, file))
      : path.join(fixtureDir, input),
    // The fixture imports the generated `styled-system` runtime, which the plugin never generates
    external: [/styled-system/],
    plugins: [plugin],
  })
  try {
    const {output} = await bundle.generate({format})
    return output
  } finally {
    await bundle.close()
  }
}

function findAsset(output: Output, fileName: string): string {
  const asset = output.find((assetOrChunk) => assetOrChunk.fileName === fileName)
  if (!asset || asset.type !== 'asset') {
    expect.unreachable(`expected an emitted \`${fileName}\` asset`)
  }
  const {source} = asset
  return typeof source === 'string' ? source : new TextDecoder().decode(source)
}

function findChunk(output: Output, name: string): OutputChunk {
  const chunk = output.find(
    (assetOrChunk) => assetOrChunk.type === 'chunk' && assetOrChunk.name === name,
  )
  if (!chunk || chunk.type !== 'chunk') {
    expect.unreachable(`expected a \`${name}\` chunk`)
  }
  return chunk
}

describe('pandaPlugin', () => {
  test('emits every cascade layer of the included files without the panda marker', async () => {
    const output = await build()
    const css = findAsset(output, DEFAULT_CSS_FILE_NAME)

    expect(css).toMatchInlineSnapshot(`
      "@layer base;

      @layer recipes {
        @layer base {
          .badge {
            font-weight: bold;
          }
        }
      }

      @layer utilities {
        .padding-inline_4 {
          padding-inline: 4px;
        }

        .color_tomato {
          color: tomato;
        }

        .display_flex {
          display: flex;
        }
      }
      "
    `)
    // Files matched by `include` are parsed even when the entry doesn't import them
    expect(css).toContain('display: flex')
    // ...while files outside `include` are not
    expect(css).not.toContain('blue')
    expect(css).not.toContain('--made-with-panda')
    // No layer order declaration
    expect(css).not.toMatch(/@layer [a-z]+,/)
  })

  test('merges `lightningcss.unusedSymbols` with the panda marker', async () => {
    const css = findAsset(
      await build({lightningcss: {unusedSymbols: ['display_flex']}}),
      DEFAULT_CSS_FILE_NAME,
    )
    expect(css).not.toContain('display_flex')
    expect(css).not.toContain('--made-with-panda')
    expect(css).toContain('padding-inline: 4px')
  })

  test('minifies only when asked to', async () => {
    const css = findAsset(await build({minify: true}), DEFAULT_CSS_FILE_NAME)
    expect(css).toContain('.display_flex{display:flex}')
    expect(css).not.toContain('--made-with-panda')
  })

  test('respects `fileName`', async () => {
    const output = await build({fileName: 'panda.css'})
    expect(findAsset(output, 'panda.css')).toContain('display: flex')
    expect(output.some((file) => file.fileName === DEFAULT_CSS_FILE_NAME)).toBe(false)
  })

  test("lowers syntax for tsdown's resolved `target`, unless disabled", async () => {
    const lowered = findAsset(
      await build({}, {tsdown: {target: ['chrome61']}}),
      DEFAULT_CSS_FILE_NAME,
    )
    expect(lowered).toContain('padding-left: 4px')
    expect(lowered).not.toContain('padding-inline:')

    const disabled = findAsset(
      await build({target: false}, {tsdown: {target: ['chrome61']}}),
      DEFAULT_CSS_FILE_NAME,
    )
    expect(disabled).toContain('padding-inline: 4px')

    // Explicit `lightningcss.targets` win over `target`
    const explicit = findAsset(
      await build({target: 'chrome61', lightningcss: {targets: {chrome: 120 << 16}}}),
      DEFAULT_CSS_FILE_NAME,
    )
    expect(explicit).toContain('padding-inline: 4px')
  })

  test('statically transforms style calls with `transform: true`', async () => {
    const output = await build({transform: true})
    const entry = findChunk(output, 'index')
    expect(entry.code).not.toContain('styled-system')
    expect(entry.code).toContain('"color_tomato padding-inline_4"')
    expect(findAsset(output, DEFAULT_CSS_FILE_NAME)).toContain('padding-inline: 4px')
  })

  test('leaves the source untouched by default', async () => {
    const entry = findChunk(await build(), 'index')
    expect(entry.code).toContain('../styled-system/css')
    expect(entry.code).not.toContain('styles.css')
  })

  describe('inject', () => {
    test('imports the stylesheet relatively from entries with panda styles', async () => {
      const output = await build({inject: true}, {input: ['src/index.ts', 'src/plain.ts']})
      expect(findChunk(output, 'index').code).toMatch(/^import "\.\/styles\.css";\n/)
      expect(findChunk(output, 'plain').code).not.toContain('styles.css')
    })

    test('requires the stylesheet in cjs output', async () => {
      const output = await build({inject: true}, {format: 'cjs'})
      expect(findChunk(output, 'index').code).toContain('require("./styles.css");')
    })

    test('uses the self-referential specifier with `exports`', async () => {
      const fromTsdown = await build(
        {inject: true, exports: true},
        {tsdown: {pkg: {name: '@fixtures/from-tsdown'} as ResolvedConfig['pkg']}},
      )
      expect(findChunk(fromTsdown, 'index').code).toMatch(
        /^import "@fixtures\/from-tsdown\/styles\.css";\n/,
      )

      // Outside tsdown the name comes from the nearest package.json
      const fromPackageJson = await build({inject: true, exports: true})
      expect(findChunk(fromPackageJson, 'index').code).toMatch(
        /^import "@fixtures\/panda-basic\/styles\.css";\n/,
      )
    })

    test('imports the stylesheet from entries that only use recipes', async () => {
      // The parse report doesn't count recipe, pattern or token calls
      const output = await build({inject: true}, {input: 'src/recipe.ts'})
      expect(findChunk(output, 'recipe').code).toMatch(/^import "\.\/styles\.css";\n/)
    })

    test('skips modules outside `include`', async () => {
      const output = await build({inject: true}, {input: 'outside.ts'})
      expect(findChunk(output, 'outside').code).not.toContain('styles.css')
      expect(findAsset(output, DEFAULT_CSS_FILE_NAME)).not.toContain('blue')
    })
  })

  test('watches the config and every parsed file, not just the bundled modules', async () => {
    const bundle = await rolldown({
      input: path.join(fixtureDir, 'src/plain.ts'),
      plugins: [pandaPlugin({cwd: fixtureDir})],
    })
    try {
      await bundle.generate({format: 'esm'})
      expect(await bundle.watchFiles).toEqual(
        expect.arrayContaining([
          path.join(fixtureDir, 'panda.config.ts'),
          path.join(fixtureDir, 'src/other.ts'),
          path.join(fixtureDir, 'src/recipe.ts'),
        ]),
      )
    } finally {
      await bundle.close()
    }
  })

  test('emits the node shims with `exports.nodeCompat`', async () => {
    const output = await build({exports: {nodeCompat: true}})
    expect(findAsset(output, 'styles-css.js')).toContain('No-op shim for `styles.css`')
    expect(findAsset(output, 'styles-css.d.ts')).toContain('export {}')

    const plain = await build({exports: true})
    expect(plain.some((file) => file.fileName === 'styles-css.js')).toBe(false)
  })
})

/** Calls the `watchChange` hook like rolldown's watcher does for a changed file. */
async function notifyChange(plugin: TsdownPlugin, file: string): Promise<void> {
  const hook = plugin.watchChange
  if (typeof hook !== 'function') expect.unreachable('expected a `watchChange` function hook')
  await hook.call({} as PluginContext, file, {event: 'update'})
}

describe('config reloads', () => {
  let dir = ''

  const writeTheme = (color: string, variants = '{}') =>
    writeFile(
      path.join(dir, 'theme.ts'),
      `export const recipes = {badge: {className: 'badge', base: {color: '${color}'}, variants: ${variants}}}\n`,
    )
  const writeConfig = (extra = '') =>
    writeFile(
      path.join(dir, 'panda.config.ts'),
      `import {recipes} from './theme'\n\nexport default {include: ['./src/**/*.ts'],${extra} outdir: 'styled-system', theme: {recipes}}\n`,
    )

  beforeEach(async () => {
    // Real path: module ids are real paths, which the watch files are compared against
    dir = await realpath(await mkdtemp(path.join(tmpdir(), 'pandacss-tsdown-plugin-')))
    await mkdir(path.join(dir, 'src'))
    await writeTheme('red')
    await writeConfig()
    await writeFile(
      path.join(dir, 'src/index.ts'),
      `import {badge} from '../styled-system/recipes'\n\nexport const label = badge()\n`,
    )
  })

  afterEach(async () => {
    if (dir) await rm(dir, {recursive: true, force: true})
  })

  /**
   * Builds with a shared plugin instance, like the rebuilds of watch mode. The generated
   * `styled-system` runtime is bundled unless `external` is set.
   */
  async function rebuild(
    plugin: TsdownPlugin,
    {
      external = false,
      before = [],
      format = 'esm',
    }: {external?: boolean; before?: Plugin[]; format?: ModuleFormat} = {},
  ) {
    const infos: string[] = []
    const warnings: string[] = []
    const bundle = await rolldown({
      input: path.join(dir, 'src/index.ts'),
      ...(external ? {external: [/styled-system/]} : {}),
      plugins: [...before, plugin],
      onLog(level, log) {
        if (level === 'info') infos.push(log.message)
        if (level === 'warn') warnings.push(log.message)
      },
    })
    try {
      const {output} = await bundle.generate({format})
      return {
        css: findAsset(output, DEFAULT_CSS_FILE_NAME),
        entry: findChunk(output, 'index').code,
        infos,
        warnings,
        watchFiles: await bundle.watchFiles,
      }
    } finally {
      await bundle.close()
    }
  }

  test('runs codegen before extracting, rewriting only what changed', async () => {
    const generated = path.join(dir, 'styled-system/recipes/badge.js')
    const plugin = pandaPlugin({cwd: dir})
    // Reads the generated code from another plugin's `buildStart`, like the declaration build
    // does: it must never see stale output, even when ordered first
    const seen: (string | undefined)[] = []
    const probe: Plugin = {
      name: 'probe',
      async buildStart() {
        seen.push(await readFile(generated, 'utf8').catch(() => undefined))
      },
    }

    const first = await rebuild(plugin, {before: [probe]})
    expect(seen.at(-1)).toContain('badge')
    expect(first.infos).toEqual([expect.stringMatching(/Generated \d+ files in styled-system$/)])
    // The entry bundles the generated runtime instead of importing a missing module
    expect(first.entry).not.toMatch(/from ["'][^"']*styled-system/)
    expect(first.css).toContain('.badge')
    const {mtimeMs} = await stat(generated)

    // Nothing changed: nothing is rewritten or reported
    const second = await rebuild(plugin, {before: [probe]})
    expect(second.infos).toEqual([])
    expect((await stat(generated)).mtimeMs).toBe(mtimeMs)

    // A reloaded config regenerates the affected files
    await writeTheme('red', `{size: {sm: {padding: '1px'}}}`)
    await notifyChange(plugin, path.join(dir, 'theme.ts'))
    const third = await rebuild(plugin, {before: [probe]})
    expect(third.infos).toEqual([expect.stringMatching(/Generated \d+ files? in styled-system$/)])
    expect(await readFile(generated, 'utf8')).toContain('"sm"')
    expect(seen.at(-1)).toContain('"sm"')
  })

  test('builds sharing the plugin wait for a reload another build started', async () => {
    // Like tsdown's per-format builds: both start together after the config changed, and the
    // second must not parse or transform with the compiler the first is replacing
    const plugin = pandaPlugin({cwd: dir, transform: true})
    const before = await Promise.all([rebuild(plugin), rebuild(plugin, {format: 'cjs'})])
    for (const result of before) expect(result.entry).toContain('"badge"')

    await writeConfig(` prefix: 'x',`)
    await notifyChange(plugin, path.join(dir, 'panda.config.ts'))
    const after = await Promise.all([rebuild(plugin), rebuild(plugin, {format: 'cjs'})])
    for (const result of after) {
      expect(result.entry).toContain('"x-badge"')
      expect(result.css).toContain('.x-badge')
    }
  })

  test('reloads the config when a file it imports changes', async () => {
    const plugin = pandaPlugin({cwd: dir})
    const first = await rebuild(plugin)
    expect(first.css).toContain('color: red')
    expect(first.watchFiles).toContain(path.join(dir, 'theme.ts'))

    await writeTheme('blue')
    await notifyChange(plugin, path.join(dir, 'theme.ts'))
    expect((await rebuild(plugin)).css).toContain('color: #00f')
  })

  test('applies narrowed `include`/`exclude` globs after a reload', async () => {
    const plugin = pandaPlugin({cwd: dir, inject: true})
    const first = await rebuild(plugin, {external: true})
    expect(first.entry).toMatch(/^import "\.\/styles\.css";\n/)
    expect(first.css).toContain('.badge')

    await writeConfig(` exclude: ['./src/index.ts'],`)
    await notifyChange(plugin, path.join(dir, 'panda.config.ts'))
    const second = await rebuild(plugin, {external: true})
    expect(second.entry).not.toContain('styles.css')
    expect(second.css).not.toContain('.badge')
    expect(second.warnings).toEqual([
      expect.stringContaining('The `include`/`exclude` globs of the Panda config changed'),
    ])
  })
})

async function runTsdownConfigHook(
  config: UserConfig,
  options: Options = {exports: {nodeCompat: true}},
): Promise<UserConfig> {
  const plugin = pandaPlugin(options)
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
  chunks: {},
  isPublish: false,
}

const conditionalCssExport = {
  types: './dist/styles-css.d.ts',
  browser: './dist/styles.css',
  style: './dist/styles.css',
  node: './dist/styles-css.js',
  default: './dist/styles-css.js',
}

describe('tsdownConfig hook', () => {
  test('writes the conditional CSS export through `exports.customExports`', async () => {
    const config = await runTsdownConfigHook({exports: {enabled: 'local-only'}})
    const result = await getCustomExports(config)(
      {'.': './src/index.ts', './package.json': './package.json'},
      customExportsContext,
    )
    expect(Object.keys(result)).toEqual(['.', './styles.css', './package.json'])
    expect(result['./styles.css']).toEqual(conditionalCssExport)
  })

  test('normalizes the boolean and CI-condition forms of the `exports` option', async () => {
    const enabled = await runTsdownConfigHook({exports: true})
    expect(await getCustomExports(enabled)({}, customExportsContext)).toEqual({
      './styles.css': conditionalCssExport,
    })

    const ciOnly = await runTsdownConfigHook({exports: 'ci-only'})
    expect(ciOnly.exports).toMatchObject({enabled: 'ci-only'})
  })

  test('composes with a pre-existing `customExports`', async () => {
    const config = await runTsdownConfigHook({
      exports: {customExports: (exports) => ({...exports, './extra': './dist/extra.js'})},
    })
    expect(await getCustomExports(config)({'.': './dist/index.js'}, customExportsContext)).toEqual({
      '.': './dist/index.js',
      './extra': './dist/extra.js',
      './styles.css': conditionalCssExport,
    })
  })

  test('declares a plain export with `exports: true`, honoring `fileName` and `outDir`', async () => {
    const config = await runTsdownConfigHook(
      {exports: true, outDir: 'lib'},
      {exports: true, fileName: 'panda.css'},
    )
    expect(await getCustomExports(config)({}, customExportsContext)).toEqual({
      './panda.css': './lib/panda.css',
    })
  })

  test('builds normalized targets relative to the package directory', async () => {
    const context = {
      ...customExportsContext,
      pkg: {packageJsonPath: path.join(fixtureDir, 'package.json')},
    }
    const exportFor = async (config: UserConfig, options?: Options) => {
      const resolved = await runTsdownConfigHook(
        {cwd: fixtureDir, exports: true, ...config},
        options,
      )
      return (await getCustomExports(resolved)({}, context))['./styles.css']
    }

    // `./dist` must not leave a `.` segment in the targets (ERR_INVALID_PACKAGE_TARGET)
    expect(await exportFor({outDir: './dist'})).toEqual(conditionalCssExport)
    expect(await exportFor({outDir: path.join(fixtureDir, 'build', 'out')}, {exports: true})).toBe(
      './build/out/styles.css',
    )
    expect(await exportFor({outDir: '.'})).toEqual({
      types: './styles-css.d.ts',
      browser: './styles.css',
      style: './styles.css',
      node: './styles-css.js',
      default: './styles-css.js',
    })
  })

  test("uses tsdown's resolved `outDir`", async () => {
    const plugin = pandaPlugin({cwd: fixtureDir, exports: true})
    const config: UserConfig = {cwd: fixtureDir, exports: true, outDir: 'unresolved'}
    await plugin.tsdownConfig?.(config, {})
    await plugin.tsdownConfigResolved?.({
      cwd: fixtureDir,
      outDir: path.join(fixtureDir, 'lib'),
    } as ResolvedConfig)
    const context = {
      ...customExportsContext,
      pkg: {packageJsonPath: path.join(fixtureDir, 'package.json')},
    }
    expect(await getCustomExports(config)({}, context)).toEqual({
      './styles.css': './lib/styles.css',
    })
  })

  test('rejects an output directory outside the package', async () => {
    const config = await runTsdownConfigHook(
      {cwd: fixtureDir, exports: true, outDir: '../elsewhere'},
      {exports: true},
    )
    const context = {
      ...customExportsContext,
      pkg: {packageJsonPath: path.join(fixtureDir, 'package.json')},
    }
    await expect(getCustomExports(config)({}, context)).rejects.toThrow(
      'can only publish the stylesheet from inside the package',
    )
  })

  test('leaves `exports` untouched without the option or without tsdown exports', async () => {
    const disabled = await runTsdownConfigHook({exports: true}, {})
    expect(disabled.exports).toBe(true)

    const noExports = await runTsdownConfigHook({}, {exports: true})
    expect(noExports.exports).toBeUndefined()
  })
})
