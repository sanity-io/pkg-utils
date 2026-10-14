import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {rolldown, type ModuleFormat, type OutputAsset, type OutputChunk} from 'rolldown'
import type {ResolvedConfig, UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
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

    test('skips modules outside `include`', async () => {
      const output = await build({inject: true}, {input: 'outside.ts'})
      expect(findChunk(output, 'outside').code).not.toContain('styles.css')
      expect(findAsset(output, DEFAULT_CSS_FILE_NAME)).not.toContain('blue')
    })
  })

  test('emits the node shims with `exports.nodeCompat`', async () => {
    const output = await build({exports: {nodeCompat: true}})
    expect(findAsset(output, 'styles-css.js')).toContain('No-op shim for `styles.css`')
    expect(findAsset(output, 'styles-css.d.ts')).toContain('export {}')

    const plain = await build({exports: true})
    expect(plain.some((file) => file.fileName === 'styles-css.js')).toBe(false)
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

  test('leaves `exports` untouched without the option or without tsdown exports', async () => {
    const disabled = await runTsdownConfigHook({exports: true}, {})
    expect(disabled.exports).toBe(true)

    const noExports = await runTsdownConfigHook({}, {exports: true})
    expect(noExports.exports).toBeUndefined()
  })
})
