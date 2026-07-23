import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {UserConfig} from 'tsdown'
import {describe, expect, expectTypeOf, test} from 'vitest'
import {defineConfig, type ReactCompilerOptions} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/react-server-library')

function getPluginNames(config: UserConfig) {
  const {plugins} = config
  if (!Array.isArray(plugins)) return undefined
  return plugins.map((plugin) =>
    plugin && typeof plugin === 'object' && 'name' in plugin ? plugin.name : undefined,
  )
}

/** Resolves the compiled (`default`) and `react-server` variants of the dual build. */
async function defineDualConfig(
  options: Parameters<typeof defineConfig>[0] = {},
): Promise<[compiled: UserConfig, reactServer: UserConfig]> {
  const configs = await defineConfig({
    ...options,
    reactCompiler: {
      ...(typeof options?.reactCompiler === 'object' ? options.reactCompiler : {}),
      reactServer: true,
    },
  })
  expect(configs).toHaveLength(2)
  const [compiled, reactServer] = configs
  if (!compiled || !reactServer) {
    return expect.unreachable('expected the compiled and react-server variants')
  }
  return [compiled, reactServer]
}

type ExportsOptionsObject = Extract<NonNullable<UserConfig['exports']>, object>
type CustomExportsFunction = Extract<
  NonNullable<ExportsOptionsObject['customExports']>,
  (...args: never[]) => unknown
>
type CustomExportsContext = Parameters<CustomExportsFunction>[1]

/** Resolves the `customExports` function the config composed into the `exports` option. */
function getCustomExports(config: UserConfig): CustomExportsFunction {
  const exportsOption = config.exports
  if (typeof exportsOption !== 'object' || typeof exportsOption?.customExports !== 'function') {
    return expect.unreachable('expected `exports.customExports` to be a function')
  }
  return exportsOption.customExports as CustomExportsFunction
}

/** Builds the `customExports` context with entry chunks shaped like the compiled build's. */
function customExportsContext(
  entryFileNames: Partial<Record<'es' | 'cjs', string[]>>,
  isPublish = true,
): CustomExportsContext {
  const chunks = Object.fromEntries(
    Object.entries(entryFileNames).map(([format, fileNames]) => [
      format,
      fileNames.map((fileName) => ({type: 'chunk', isEntry: true, fileName, outDir: 'dist'})),
    ]),
  )
  return {
    pkg: {packageJsonPath: 'package.json'},
    chunks,
    isPublish,
  } as unknown as CustomExportsContext
}

function outExtension(config: UserConfig, format: 'es' | 'cjs', pkgType?: 'module' | 'commonjs') {
  const {outExtensions} = config
  if (typeof outExtensions !== 'function') {
    return expect.unreachable('expected `outExtensions` to be a function')
  }
  return outExtensions({format, pkgType, options: {}} as unknown as Parameters<
    NonNullable<UserConfig['outExtensions']>
  >[0])
}

describe('reactCompiler.reactServer option', () => {
  test('stays a single build without it', async () => {
    for (const config of [
      await defineConfig({reactCompiler: true}),
      await defineConfig({reactCompiler: {target: '19'}}),
      await defineConfig({reactCompiler: {target: '19', reactServer: false}}),
    ]) {
      expect(Array.isArray(config)).toBe(false)
      expect(getPluginNames(config)).toEqual(['@rolldown/plugin-babel'])
      expect(config.exports).not.toHaveProperty('customExports')
      expect(config.outExtensions).toBeUndefined()
    }
  })

  test('narrows the return type per overload', async () => {
    // Literal `reactServer: true` resolves to the two variants
    const dual = defineConfig({reactCompiler: {target: '19', reactServer: true}})
    expectTypeOf(dual).toEqualTypeOf<Promise<UserConfig[]>>()

    // Without `reactServer` (or with a literal `false`) the config stays a single build
    expectTypeOf(defineConfig()).toEqualTypeOf<Promise<UserConfig>>()
    expectTypeOf(defineConfig({reactCompiler: true})).toEqualTypeOf<Promise<UserConfig>>()
    const single = defineConfig({reactCompiler: {target: '19'}})
    expectTypeOf(single).toEqualTypeOf<Promise<UserConfig>>()
    const explicitlyOff = defineConfig({reactCompiler: {target: '19', reactServer: false}})
    expectTypeOf(explicitlyOff).toEqualTypeOf<Promise<UserConfig>>()

    // When `reactServer` is widened to `boolean` (e.g. a `ReactCompilerOptions`-typed
    // variable), TypeScript can't tell which shape resolves - the return type is the union,
    // so callers have to check `Array.isArray` instead of wrongly assuming a single config
    const widenedOptions: ReactCompilerOptions = {target: '19', reactServer: true}
    const widened = defineConfig({reactCompiler: widenedOptions})
    expectTypeOf(widened).toEqualTypeOf<Promise<UserConfig | UserConfig[]>>()

    // ...and at runtime the widened call indeed resolves to the dual build
    expect(await widened).toHaveLength(2)
    await Promise.all([dual, single, explicitlyOff])
  })

  test('resolves the compiled and react-server variants', async () => {
    const [compiled, reactServer] = await defineDualConfig({reactCompiler: {target: '19'}})

    // The compiled variant is the classic single build: the React Compiler applied, and it
    // owns `dts`, `exports` generation and `publint`
    expect(getPluginNames(compiled)).toEqual(['@rolldown/plugin-babel'])
    expect(compiled.publint).toBe(true)
    expect(compiled.exports).toMatchObject({enabled: 'local-only'})

    // The react-server variant builds the same source without the compiler, skips d.ts (the
    // compiled variant's declarations serve both entries), never cleans (the compiled
    // variant's `clean` covers the run - tsdown cleans once, before either variant emits),
    // and stays out of `exports` generation and `publint`
    expect(getPluginNames(reactServer)).toEqual([])
    expect(reactServer.dts).toBe(false)
    expect(reactServer.clean).toBe(false)
    expect(reactServer.exports).toBe(false)
    expect(reactServer.publint).toBe(false)
  })

  test('react-server entries sit next to the compiled ones with `.react-server` inserted', async () => {
    const [compiled, reactServer] = await defineDualConfig()

    // tsdown's default extension for the format/package type, with `.react-server` inserted
    expect(outExtension(reactServer, 'es', 'module')).toEqual({js: '.react-server.js'})
    expect(outExtension(reactServer, 'cjs', 'module')).toEqual({js: '.react-server.cjs'})
    expect(outExtension(reactServer, 'es', 'commonjs')).toEqual({js: '.react-server.mjs'})
    expect(outExtension(reactServer, 'cjs', 'commonjs')).toEqual({js: '.react-server.js'})

    // The compiled variant keeps tsdown's default naming
    expect(compiled.outExtensions).toBeUndefined()
  })

  test('inserts the react-server condition into entry exports', async () => {
    const [compiled] = await defineDualConfig()
    const customExports = getCustomExports(compiled)

    // The pure-ESM publish shape: a bare-string entry export becomes a conditional export
    // with `types` specified before `react-server` (the `.react-server.` file has no
    // declaration sibling - the compiled build's declarations serve every resolution mode),
    // and `react-server` resolving before `default`
    const result = await customExports(
      {'.': './dist/index.js', './package.json': './package.json'},
      customExportsContext({es: ['index.js', 'index.d.ts']}),
    )
    expect(result).toEqual({
      '.': {
        'types': './dist/index.d.ts',
        'react-server': './dist/index.react-server.js',
        'default': './dist/index.js',
      },
      './package.json': './package.json',
    })
    expect(Object.keys(result['.'])).toEqual(['types', 'react-server', 'default'])
  })

  test('matches entry exports exactly, never by leaf name', async () => {
    const [compiled] = await defineDualConfig()
    const customExports = getCustomExports(compiled)

    // `index.js` and `features/index.js` share a leaf name: export targets are compared as
    // full `./<outDir>/<fileName>` strings, so the declaration existence check runs against
    // each entry's own `.d.ts` (only the root entry has one here - no `types` condition is
    // invented for `./features`), and a non-entry file that merely ends in an entry's
    // filename passes through untouched
    const result = await customExports(
      {
        '.': './dist/index.js',
        './features': './dist/features/index.js',
        './not-an-entry': './dist/vendored/index.js',
      },
      customExportsContext({es: ['index.js', 'features/index.js', 'index.d.ts']}),
    )
    expect(result).toEqual({
      '.': {
        'types': './dist/index.d.ts',
        'react-server': './dist/index.react-server.js',
        'default': './dist/index.js',
      },
      './features': {
        'react-server': './dist/features/index.react-server.js',
        'default': './dist/features/index.js',
      },
      './not-an-entry': './dist/vendored/index.js',
    })
  })

  test('omits the types condition when no declarations are emitted', async () => {
    const [compiled] = await defineDualConfig()
    const customExports = getCustomExports(compiled)

    // Without declaration chunks (`dts: false` packages) there is no `types` file to point
    // at, and the entry keeps the plain dual shape
    const result = await customExports(
      {'.': './dist/index.js'},
      customExportsContext({es: ['index.js']}),
    )
    expect(result).toEqual({
      '.': {'react-server': './dist/index.react-server.js', 'default': './dist/index.js'},
    })
  })

  test('nests import/require under react-server for dual-format entries', async () => {
    const [compiled] = await defineDualConfig()
    const customExports = getCustomExports(compiled)

    const result = await customExports(
      {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
          require: './dist/index.cjs',
        },
      },
      customExportsContext({es: ['index.js'], cjs: ['index.cjs']}),
    )
    expect(result['.']).toEqual({
      'types': './dist/index.d.ts',
      'react-server': {
        import: './dist/index.react-server.js',
        require: './dist/index.react-server.cjs',
      },
      'import': './dist/index.js',
      'require': './dist/index.cjs',
    })
    // Conditions match in order: an already-present `types` stays first (and is left alone),
    // `react-server` comes right before the runtime conditions
    expect(Object.keys(result['.'])).toEqual(['types', 'react-server', 'import', 'require'])
  })

  test('nests format-matched types under react-server for dual-format entries', async () => {
    const [compiled] = await defineDualConfig()
    const customExports = getCustomExports(compiled)

    // Without a top-level `types` condition, dual-format entries rely on TypeScript's
    // adjacent-file lookup (`index.js` ↔ `index.d.ts`, `index.cjs` ↔ `index.d.cts`) - which
    // cannot work for the declaration-less `.react-server.` files. A single top-level
    // `types` file can't serve both resolution modes either, so each format nests its own
    // `types` under the `react-server` condition instead
    const result = await customExports(
      {'.': {import: './dist/index.js', require: './dist/index.cjs'}},
      customExportsContext({
        es: ['index.js', 'index.d.ts'],
        cjs: ['index.cjs', 'index.d.cts'],
      }),
    )
    expect(result['.']).toEqual({
      'react-server': {
        import: {types: './dist/index.d.ts', default: './dist/index.react-server.js'},
        require: {types: './dist/index.d.cts', default: './dist/index.react-server.cjs'},
      },
      'import': './dist/index.js',
      'require': './dist/index.cjs',
    })
  })

  test('covers every entry, and leaves non-entry exports untouched', async () => {
    const [compiled] = await defineDualConfig()
    const customExports = getCustomExports(compiled)

    const conditionalCssExport = {
      types: './dist/bundle-css.d.ts',
      browser: './dist/bundle.css',
      style: './dist/bundle.css',
      node: './dist/bundle-css.js',
      default: './dist/bundle-css.js',
    }
    const result = await customExports(
      {
        '.': './dist/index.js',
        './theme': './dist/theme.js',
        './bundle.css': conditionalCssExport,
        './package.json': './package.json',
      },
      customExportsContext({es: ['index.js', 'theme.js']}),
    )
    expect(result).toEqual({
      '.': {'react-server': './dist/index.react-server.js', 'default': './dist/index.js'},
      './theme': {'react-server': './dist/theme.react-server.js', 'default': './dist/theme.js'},
      // The conditional CSS export of `vanillaExtract` names no entry chunks - untouched
      './bundle.css': conditionalCssExport,
      './package.json': './package.json',
    })
  })

  test('leaves the `devExports` source map untouched', async () => {
    const [compiled] = await defineDualConfig()
    const customExports = getCustomExports(compiled)

    // With `devExports: true` the local `exports` map points at source files: source resolves
    // for every condition in development, which is correct - uncompiled source is exactly
    // what the `react-server` condition ships
    const result = await customExports(
      {'.': './src/index.ts', './package.json': './package.json'},
      customExportsContext({es: ['index.js']}, false),
    )
    expect(result).toEqual({'.': './src/index.ts', './package.json': './package.json'})
  })

  test('keeps a custom development condition ahead of react-server', async () => {
    const [compiled] = await defineDualConfig({exports: {devExports: '@sanity/source'}})
    const customExports = getCustomExports(compiled)

    const result = await customExports(
      {'.': {'@sanity/source': './src/index.ts', 'default': './dist/index.js'}},
      customExportsContext({es: ['index.js']}),
    )
    expect(Object.keys(result['.'])).toEqual(['@sanity/source', 'react-server', 'default'])
    expect(result['.']).toMatchObject({'react-server': './dist/index.react-server.js'})
  })

  test('composes with a pre-existing `customExports`', async () => {
    const [withRecord] = await defineDualConfig({
      exports: {customExports: {'./worker.js': './dist/worker.js'}},
    })
    expect(
      await getCustomExports(withRecord)(
        {'.': './dist/index.js'},
        customExportsContext({es: ['index.js']}),
      ),
    ).toEqual({
      '.': {'react-server': './dist/index.react-server.js', 'default': './dist/index.js'},
      // The record form applies first, like tsdown itself applies it - and `worker.js` names
      // no entry chunk, so it passes through untouched
      './worker.js': './dist/worker.js',
    })

    const [withFunction] = await defineDualConfig({
      exports: {customExports: (exports) => ({...exports, './worker.js': './dist/worker.js'})},
    })
    expect(
      await getCustomExports(withFunction)(
        {'.': './dist/index.js'},
        customExportsContext({es: ['index.js']}),
      ),
    ).toEqual({
      '.': {'react-server': './dist/index.react-server.js', 'default': './dist/index.js'},
      './worker.js': './dist/worker.js',
    })
  })
})

describe('react-server-library', () => {
  test('applies the React Compiler only to the compiled output', async () => {
    const [distIndexJs, distIndexServerJs] = await Promise.all([
      readFile(path.join(fixtureDir, 'dist/index.js'), 'utf-8'),
      readFile(path.join(fixtureDir, 'dist/index.react-server.js'), 'utf-8'),
    ])

    // The compiled output is auto-memoized with the memo cache provided by
    // `react/compiler-runtime` (the fixture sets `reactCompiler: {target: '19'}`)
    expect(distIndexJs).toContain('react/compiler-runtime')

    // The react-server output is the same source without the compiler: no
    // `react/compiler-runtime` (it throws in the `react-server` environment), and - the
    // source has no manual memoization - no `useMemo`/`useCallback` calls either
    expect(distIndexServerJs).not.toContain('react/compiler-runtime')
    expect(distIndexServerJs).not.toContain('useMemo(')
    expect(distIndexServerJs).not.toContain('useCallback(')
  })

  test('wires the react-server export condition', async () => {
    const pkg = JSON.parse(await readFile(path.join(fixtureDir, 'package.json'), 'utf-8'))

    // The local `exports` map keeps pointing at the source (`devExports`), which resolves
    // for every condition in development
    expect(pkg.exports['.']).toBe('./src/index.ts')

    // `publishConfig.exports` resolves `react-server` to the uncompiled build, everything
    // else to the compiled one - with `types` specified before `react-server`, since the
    // `.react-server.` file has no declaration sibling for adjacent-file lookup
    expect(pkg.publishConfig.exports['.']).toEqual({
      'types': './dist/index.d.ts',
      'react-server': './dist/index.react-server.js',
      'default': './dist/index.js',
    })
    expect(Object.keys(pkg.publishConfig.exports['.'])).toEqual([
      'types',
      'react-server',
      'default',
    ])

    // The react-server files never become export subpaths of their own
    expect(Object.keys(pkg.exports)).toEqual(['.', './package.json'])
    expect(Object.keys(pkg.publishConfig.exports)).toEqual(['.', './package.json'])
  })

  test('only the compiled variant emits type declarations', async () => {
    const distIndexDts = await readFile(path.join(fixtureDir, 'dist/index.d.ts'), 'utf-8')
    expect(distIndexDts).toContain('PortableText')

    // The compiled variant's declarations serve both entries - TypeScript resolves types
    // through the `default` condition
    await expect(
      readFile(path.join(fixtureDir, 'dist/index.react-server.d.ts'), 'utf-8'),
    ).rejects.toMatchObject({code: 'ENOENT'})
  })
})
