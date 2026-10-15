import {cp, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {setTimeout as delay} from 'node:timers/promises'
import {fileURLToPath} from 'node:url'
import {compileFunction} from 'node:vm'
import type {Config} from '@pandacss/dev'
import {
  rolldown,
  watch,
  type ModuleFormat,
  type OutputAsset,
  type OutputChunk,
  type Plugin,
  type PluginContext,
} from 'rolldown'
import {build as tsdownBuild, type ResolvedConfig, type TsdownPlugin, type UserConfig} from 'tsdown'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {DEFAULT_CSS_FILE_NAME, pandaPlugin, type Options} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/basic')

/** Stands in for tsdown's logger in the partial configs the tests resolve. */
const logger = {info: () => {}, warn: () => {}}

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
    await plugin.tsdownConfigResolved?.({cwd: fixtureDir, logger, ...tsdown} as ResolvedConfig)
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

test('depends on the Panda packages it imports, with `@pandacss/dev` as an optional peer', async () => {
  // Like `@pandacss/vite`, Panda's compiler and transformer are regular dependencies, while
  // `@pandacss/dev` is an optional `*` peer, so a project that installs it keeps a single copy
  const manifest: unknown = JSON.parse(
    await readFile(path.resolve(__dirname, '../package.json'), 'utf8'),
  )
  expect(manifest).toMatchObject({
    dependencies: {
      '@pandacss/compiler': expect.any(String),
      '@pandacss/compiler-shared': expect.any(String),
      '@pandacss/transformer': expect.any(String),
    },
  })
  expect(manifest).toHaveProperty('peerDependencies', {
    '@pandacss/dev': '*',
    'tsdown': expect.any(String),
  })
  expect(manifest).toHaveProperty('peerDependenciesMeta', {'@pandacss/dev': {optional: true}})
})

test('the fixtures check their configs with `satisfies Config`', () => {
  // The pattern every `panda.config.ts` fixture follows, so options Panda doesn't have fail
  // the type check instead of being ignored
  // @ts-expect-error -- `eject` is not a Panda option
  const config = {include: ['./src/**/*.ts'], eject: true} satisfies Config
  expect(config.include).toEqual(['./src/**/*.ts'])
})

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

  test('lowers syntax for the lowest version of a browser the targets repeat', async () => {
    for (const target of [
      ['chrome61', 'chrome120'],
      ['chrome120', 'chrome61'],
    ]) {
      const css = findAsset(await build({target}), DEFAULT_CSS_FILE_NAME)
      expect(css).toContain('padding-left: 4px')
      expect(css).not.toContain('padding-inline:')
    }
  })

  test('statically transforms style calls by default, unlike `@pandacss/vite`', async () => {
    for (const options of [{}, {transform: true}]) {
      const output = await build(options)
      const entry = findChunk(output, 'index')
      expect(entry.code).not.toContain('styled-system')
      expect(entry.code).toContain('"color_tomato padding-inline_4"')
      expect(findAsset(output, DEFAULT_CSS_FILE_NAME)).toContain('padding-inline: 4px')
    }
  })

  test('leaves the source untouched with `transform: false`', async () => {
    const output = await build({transform: false})
    const entry = findChunk(output, 'index')
    expect(entry.code).toContain('../styled-system/css')
    expect(entry.code).not.toContain('"color_tomato padding-inline_4"')
    expect(entry.code).not.toContain('styles.css')
    // The stylesheet is extracted either way
    expect(findAsset(output, DEFAULT_CSS_FILE_NAME)).toContain('padding-inline: 4px')
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

    test('keeps a dot-prefixed `fileName` relative', async () => {
      // `.assets/styles.css` on its own would be a package specifier
      const output = await build({inject: true, fileName: '.assets/styles.css'})
      expect(findChunk(output, 'index').code).toMatch(/^import "\.\/\.assets\/styles\.css";\n/)
      expect(findAsset(output, '.assets/styles.css')).toContain('display: flex')

      const bundle = await rolldown({
        input: path.join(fixtureDir, 'src/index.ts'),
        external: [/styled-system/],
        plugins: [pandaPlugin({cwd: fixtureDir, inject: true, fileName: '.assets/styles.css'})],
      })
      try {
        const {output: nested} = await bundle.generate({
          format: 'esm',
          entryFileNames: 'nested/[name].js',
        })
        expect(findChunk(nested, 'index').code).toMatch(/^import "\.\.\/\.assets\/styles\.css";\n/)
      } finally {
        await bundle.close()
      }
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

/** A module under `src/` that styles one value with `css()` from the generated runtime. */
function cssSource(name: string, color: string): string {
  return `import {css} from '../styled-system/css'\n\nexport const ${name} = css({color: '${color}'})\n`
}

/**
 * Runs rolldown's watcher (polling, so file events behave the same on every OS), counting the
 * finished builds.
 */
function startWatcher(plugin: TsdownPlugin, input: string, outDir: string) {
  const watcher = watch({
    input,
    plugins: [plugin],
    output: {dir: outDir, format: 'esm'},
    watch: {watcher: {usePolling: true, pollInterval: 50}},
  })
  let builds = 0
  let failure: unknown
  let waiting: {count: number; resolve: () => void; reject: (error: unknown) => void}[] = []
  const settle = (): void => {
    waiting = waiting.filter((waiter) => {
      if (failure !== undefined) waiter.reject(failure)
      else if (builds >= waiter.count) waiter.resolve()
      else return true
      return false
    })
  }
  watcher.on('event', (event) => {
    if (event.code === 'BUNDLE_END') {
      void event.result.close()
      builds++
      settle()
    } else if (event.code === 'ERROR') {
      void event.result.close()
      failure = event.error
      settle()
    }
  })
  return {
    builds: (): number => builds,
    waitForBuild: (count: number): Promise<void> =>
      new Promise((resolve, reject) => {
        waiting.push({count, resolve, reject})
        settle()
      }),
    close: (): Promise<void> => watcher.close(),
  }
}

/**
 * The fixture the reload tests copy into a temporary project. Its `panda.*.ts` variants are
 * type-checked configs the tests swap in as `panda.config.ts`.
 */
const reloadFixtureDir = path.resolve(__dirname, 'fixtures/reload')

/**
 * The temporary projects live in the package, so the configs resolve `@pandacss/dev` from its
 * `node_modules` (`test/.tmp` is gitignored)
 */
const temporaryDir = path.resolve(__dirname, '.tmp')

describe('config reloads', () => {
  let dir = ''

  const writeTheme = (color: string, variants = '{}') =>
    writeFile(
      path.join(dir, 'theme.ts'),
      `export const recipes = {badge: {className: 'badge', base: {color: '${color}'}, variants: ${variants}}}\n`,
    )
  const useConfig = (variant: 'narrowed' | 'prefixed' | 'root' | 'scan' | 'windows') =>
    cp(path.join(dir, `panda.${variant}.ts`), path.join(dir, 'panda.config.ts'))

  beforeEach(async () => {
    await mkdir(temporaryDir, {recursive: true})
    // Real path: module ids are real paths, which the watch files are compared against
    dir = await realpath(await mkdtemp(path.join(temporaryDir, 'project-')))
    await cp(reloadFixtureDir, dir, {recursive: true})
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

    await useConfig('prefixed')
    await notifyChange(plugin, path.join(dir, 'panda.config.ts'))
    const after = await Promise.all([rebuild(plugin), rebuild(plugin, {format: 'cjs'})])
    for (const result of after) {
      expect(result.entry).toContain('"x-badge"')
      expect(result.css).toContain('.x-badge')
    }
  })

  test('keeps the overridden `outdir` out of the scan', async () => {
    // Codegen writes into `src/generated`, which the config's `include` matches
    await useConfig('scan')
    await writeFile(path.join(dir, 'src/index.ts'), cssSource('box', 'red'))
    await writeFile(path.join(dir, 'src/extra.ts'), cssSource('extra', 'blue'))
    await mkdir(path.join(dir, 'src/ignored'))
    await writeFile(path.join(dir, 'src/ignored/skipped.ts'), cssSource('skipped', 'orange'))

    const plugin = pandaPlugin({cwd: dir, outdir: 'src/generated'})
    const first = await rebuild(plugin, {external: true})
    expect(await readFile(path.join(dir, 'src/generated/css/index.js'), 'utf8')).toBeTruthy()
    // Every parsed file is watched: nothing generated, and the config's own exclusions still apply
    const scanned = first.watchFiles.map((file) => path.relative(dir, file).replaceAll('\\', '/'))
    expect(scanned.filter((file) => file.startsWith('src/'))).toEqual(
      expect.arrayContaining(['src/index.ts', 'src/extra.ts']),
    )
    expect(scanned.filter((file) => file.startsWith('src/generated/'))).toEqual([])
    expect(scanned).not.toContain('src/ignored/skipped.ts')
    expect(first.css).toContain('color: #00f')
    expect(first.css).not.toContain('orange')

    // Deleted files drop out of the stylesheet, which a scan with options doesn't do on its own
    await rm(path.join(dir, 'src/extra.ts'))
    expect((await rebuild(plugin, {external: true})).css).not.toContain('#00f')
  })

  test(
    'rebuilds when a new file matches `include`, even if no entry imports it',
    {timeout: 30_000},
    async () => {
      const watcher = startWatcher(
        pandaPlugin({cwd: dir}),
        path.join(dir, 'src/index.ts'),
        path.join(dir, 'dist'),
      )
      try {
        await watcher.waitForBuild(1)
        expect(await readFile(path.join(dir, 'dist/styles.css'), 'utf8')).not.toContain('purple')

        await delay(300)
        await writeFile(path.join(dir, 'src/extra.ts'), cssSource('extra', 'purple'))
        await watcher.waitForBuild(2)
        expect(await readFile(path.join(dir, 'dist/styles.css'), 'utf8')).toContain('purple')
      } finally {
        await watcher.close()
      }
    },
  )

  test(
    'keeps the build output out of the watched `include` directories',
    {timeout: 30_000},
    async () => {
      // `./**/*.ts` makes the project root an `include` base, holding `dist` and `styled-system`
      await useConfig('root')
      await mkdir(path.join(dir, 'lib'))
      const watcher = startWatcher(
        pandaPlugin({cwd: dir}),
        path.join(dir, 'src/index.ts'),
        path.join(dir, 'dist'),
      )
      try {
        await watcher.waitForBuild(1)
        // Writing `dist` must not trigger the next build
        await delay(1500)
        expect(watcher.builds()).toBe(1)

        await writeFile(path.join(dir, 'lib/extra.ts'), cssSource('extra', 'purple'))
        await watcher.waitForBuild(2)
        expect(await readFile(path.join(dir, 'dist/styles.css'), 'utf8')).toContain('purple')
        await delay(1500)
        expect(watcher.builds()).toBe(2)
      } finally {
        await watcher.close()
      }
    },
  )

  test(
    're-transforms the modules in watch mode when the class names change',
    {timeout: 30_000},
    async () => {
      const watcher = startWatcher(
        pandaPlugin({cwd: dir, transform: true}),
        path.join(dir, 'src/index.ts'),
        path.join(dir, 'dist'),
      )
      try {
        await watcher.waitForBuild(1)
        expect(await readFile(path.join(dir, 'dist/index.js'), 'utf8')).toContain('"badge"')

        await delay(300)
        await useConfig('prefixed')
        await watcher.waitForBuild(2)
        // The unchanged module carries the new class names, matching the stylesheet
        expect(await readFile(path.join(dir, 'dist/index.js'), 'utf8')).toContain('"x-badge"')
        expect(await readFile(path.join(dir, 'dist/styles.css'), 'utf8')).toContain('.x-badge')
      } finally {
        await watcher.close()
      }
    },
  )

  // `inject` writes through rolldown's native magic-string, or a string fallback when another
  // plugin turned it off: the directive prologue must survive either way
  for (const nativeMagicString of [true, false]) {
    const via = nativeMagicString ? 'native magic-string' : 'string fallback'
    const plugins = (): Plugin[] => [
      pandaPlugin({cwd: dir, inject: true}),
      ...(nativeMagicString
        ? []
        : [
            {
              name: 'without-native-magic-string',
              options: (inputOptions) => ({
                ...inputOptions,
                experimental: {...inputOptions.experimental, nativeMagicString: false},
              }),
            } satisfies Plugin,
          ]),
    ]

    test(`injects the CJS stylesheet load after the directive prologue, keeping strict mode (${via})`, async () => {
      await writeFile(
        path.join(dir, 'src/index.ts'),
        `'use client'\nimport {badge} from '../styled-system/recipes'\n\nexport const label = badge()\n\nexport function self() {\n  return this\n}\n`,
      )
      const warnings: string[] = []
      const bundle = await rolldown({
        input: path.join(dir, 'src/index.ts'),
        plugins: plugins(),
        onLog(level, log) {
          if (level === 'warn' && log.code !== 'MODULE_LEVEL_DIRECTIVE') warnings.push(log.message)
        },
      })
      try {
        const {output} = await bundle.generate({format: 'cjs', strict: true, sourcemap: true})
        const {code, map} = findChunk(output, 'index')

        // A bare call of a function returning `this` only gives `undefined` in strict mode
        const module: {exports: Record<string, unknown>} = {exports: {}}
        const required: string[] = []
        const require = (id: string): object => {
          required.push(id)
          return {}
        }
        Reflect.apply(compileFunction(code, ['require', 'module', 'exports']), undefined, [
          require,
          module,
          module.exports,
        ])
        expect(required).toEqual(['./styles.css'])
        const self = module.exports['self']
        if (typeof self !== 'function') expect.unreachable('expected the `self` export')
        expect(Reflect.apply(self, undefined, [])).toBeUndefined()

        // Both directives stay in the prologue, ahead of the stylesheet load
        expect(code).toMatch(
          /^(?:["']use (?:strict|client)["'];\n){2}require\("\.\/styles\.css"\);\n/,
        )
        expect(code).toMatch(/["']use client["']/)
        expect(map).toBeTruthy()
        // Only the fallback can't keep the sourcemap aligned, which both the plugin and rolldown
        // report
        expect(warnings).toEqual(
          nativeMagicString
            ? []
            : [
                expect.stringContaining('native magic-string is unavailable'),
                expect.stringContaining('SOURCEMAP_BROKEN'),
              ],
        )
      } finally {
        await bundle.close()
      }
    })

    test(`injects the import after the hashbang and directives (${via})`, async () => {
      await writeFile(
        path.join(dir, 'src/index.ts'),
        `#!/usr/bin/env node\n'use client'\nimport {badge} from '../styled-system/recipes'\n\nexport const label = badge()\n`,
      )
      const bundle = await rolldown({
        input: path.join(dir, 'src/index.ts'),
        plugins: plugins(),
        // `'use client'` is reported as a module-level directive that bundling may not preserve
        onLog() {},
      })
      try {
        const {output} = await bundle.generate({format: 'esm'})
        expect(findChunk(output, 'index').code).toMatch(
          /^#!\/usr\/bin\/env node\n["']use client["'];\nimport "\.\/styles\.css";\n/,
        )
      } finally {
        await bundle.close()
      }
    })
  }

  test('escapes glob metacharacters in the project path', async () => {
    const project = path.join(dir, 'lib[1]')
    await cp(reloadFixtureDir, project, {recursive: true})
    const plugin = pandaPlugin({cwd: project, inject: true})
    const bundle = await rolldown({
      input: path.join(project, 'src/index.ts'),
      external: [/styled-system/],
      plugins: [plugin],
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      const entry = findChunk(output, 'index').code
      // The filter matched the module: it was transformed and gets the stylesheet
      expect(entry).toMatch(/^import "\.\/styles\.css";\n/)
      expect(entry).toContain('"badge"')
    } finally {
      await bundle.close()
    }
    // The generated directory is excluded under the same escaped path
    const {transform} = plugin
    if (typeof transform !== 'object') expect.unreachable('expected an object `transform` hook')
    expect(transform.filter).toMatchObject({
      id: {
        include: [expect.stringMatching(/\/lib\\\[1\\\]\/src\/\*\*\/\*\.ts$/)],
        exclude: expect.arrayContaining([
          expect.stringMatching(/\/lib\\\[1\\\]\/styled-system\/\*\*$/),
        ]),
      },
    })
  })

  test('keeps Windows absolute globs absolute, with forward slashes', async () => {
    // Backslash separators are escapes in rolldown's globs, and must not get the project path
    // prefixed like a relative glob
    await useConfig('windows')
    const plugin = pandaPlugin({cwd: dir})
    await plugin.tsdownConfigResolved?.({cwd: dir, logger} as ResolvedConfig)
    const {transform} = plugin
    if (typeof transform !== 'object') expect.unreachable('expected an object `transform` hook')
    expect(transform.filter).toMatchObject({
      id: {
        include: ['C:/work/lib/src/**/*.ts'],
        exclude: expect.arrayContaining(['C:/work/lib/src/drafts/**', '//server/share/lib/**']),
      },
    })
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

    await useConfig('narrowed')
    await notifyChange(plugin, path.join(dir, 'panda.config.ts'))
    const second = await rebuild(plugin, {external: true})
    expect(second.entry).not.toContain('styles.css')
    expect(second.css).not.toContain('.badge')
    expect(second.warnings).toEqual([
      expect.stringContaining('The `include`/`exclude` globs of the Panda config changed'),
    ])
  })
})

/** A project that imports codegen output, which the tests delete so tsdown builds it clean. */
const declarationsFixtureDir = path.resolve(__dirname, 'fixtures/declarations')

describe('tsdown builds', () => {
  let dir = ''

  beforeEach(async () => {
    await mkdir(temporaryDir, {recursive: true})
    dir = await realpath(await mkdtemp(path.join(temporaryDir, 'tsdown-')))
    await cp(declarationsFixtureDir, dir, {recursive: true})
    await rm(path.join(dir, 'styled-system'), {recursive: true, force: true})
    const compilerOptions = {
      strict: true,
      target: 'esnext',
      module: 'preserve',
      moduleResolution: 'bundler',
      skipLibCheck: true,
    }
    await writeFile(
      path.join(dir, 'tsconfig.json'),
      `${JSON.stringify({compilerOptions, include: ['src']})}\n`,
    )
  })

  afterEach(async () => {
    if (dir) await rm(dir, {recursive: true, force: true})
  })

  test('runs codegen before the separate CJS declaration build', {timeout: 60_000}, async () => {
    // tsdown emits CJS declarations from a second build, without the user plugins, that runs in
    // parallel with the JS build. The slow `options` hook of an earlier plugin holds up the
    // later hooks of the JS build
    const slowOptions: Plugin = {
      name: 'slow-options',
      async options() {
        await delay(1_000)
      },
    }
    await tsdownBuild({
      cwd: dir,
      config: false,
      entry: ['src/index.ts'],
      format: 'cjs',
      dts: true,
      logLevel: 'silent',
      plugins: [slowOptions, pandaPlugin()],
    })

    // The inferred type comes from the generated `css` declaration, or is `any` without it
    expect(await readFile(path.join(dir, 'dist/index.d.cts'), 'utf8')).toMatch(
      /declare const button: string;/,
    )
    expect(await readFile(path.join(dir, 'dist/index.cjs'), 'utf8')).toContain('"color_tomato"')
    expect(await readFile(path.join(dir, `dist/${DEFAULT_CSS_FILE_NAME}`), 'utf8')).toContain(
      '.color_tomato',
    )
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
      logger,
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
