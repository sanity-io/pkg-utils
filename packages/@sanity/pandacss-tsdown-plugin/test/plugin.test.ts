import {
  cpSync,
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
import vm from 'node:vm'
import {rolldown, watch, type OutputAsset, type OutputChunk} from 'rolldown'
import {build as tsdownBuild, type ResolvedConfig, type UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {esbuildTargetToLightningCSS, pandacssPlugin, type Options} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/basic')
const fixtureEntry = path.join(fixtureDir, 'src/index.ts')
const recipesFixtureDir = path.resolve(__dirname, 'fixtures/recipes')

/**
 * A throwaway copy of the `codegen` fixture under `test/fixtures/<name>.local` (gitignored
 * through `*.local`, and inside the package so `panda.config.ts` still resolves
 * `@pandacss/dev`), optionally with another `panda.config.ts`. The plugin regenerates
 * `styled-system` at build start, so only the sources are copied.
 */
function copyFixture(name: string, pandaConfig?: string): string {
  const source = path.resolve(__dirname, 'fixtures/codegen')
  const target = path.resolve(__dirname, 'fixtures', `${name}.local`)
  rmSync(target, {recursive: true, force: true})
  mkdirSync(target, {recursive: true})
  cpSync(path.join(source, 'package.json'), path.join(target, 'package.json'))
  cpSync(path.join(source, 'src'), path.join(target, 'src'), {recursive: true})
  writeFileSync(
    path.join(target, 'panda.config.ts'),
    pandaConfig ?? readFileSync(path.join(source, 'panda.config.ts'), 'utf-8'),
  )
  return target
}

/** The `codegen` fixture's Panda config with another `include`. */
function withInclude(include: string): string {
  return readFileSync(path.resolve(__dirname, 'fixtures/codegen/panda.config.ts'), 'utf-8').replace(
    "include: ['./src/**/*.ts']",
    `include: [${JSON.stringify(include)}]`,
  )
}

/**
 * Runs a built CommonJS chunk the way Node would (a module wrapper with a stub `require`, so
 * the injected CSS load is a no-op) and returns its exports.
 */
function evaluateCommonJs(source: string): {isStrict(): boolean; strictBox: string} {
  const module = {exports: {} as {isStrict(): boolean; strictBox: string}}
  vm.compileFunction(source, ['require', 'module', 'exports'])(() => ({}), module, module.exports)
  return module.exports
}

/** The `include`/`exclude` RegExps of a plugin's derived `transform` filter. */
function transformFilterPatterns(plugin: ReturnType<typeof pandacssPlugin>): {
  include: RegExp[]
  exclude: RegExp[]
} {
  const {transform} = plugin
  if (typeof transform !== 'object' || !transform.filter || Array.isArray(transform.filter)) {
    expect.unreachable('expected an object hook with a `HookFilter`')
  }
  const {id} = transform.filter
  if (typeof id !== 'object' || id === null || id instanceof RegExp || Array.isArray(id)) {
    expect.unreachable('expected an `include`/`exclude` id filter')
  }
  const toRegExps = (patterns: typeof id.include): RegExp[] =>
    (Array.isArray(patterns) ? patterns : patterns === undefined ? [] : [patterns]).map(
      (pattern) => {
        if (!(pattern instanceof RegExp)) expect.unreachable('expected a RegExp filter')
        return pattern
      },
    )
  return {include: toRegExps(id.include), exclude: toRegExps(id.exclude)}
}

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
  input: string = fixtureEntry,
): Promise<readonly (OutputAsset | OutputChunk)[]> {
  const bundle = await rolldown({
    cwd: fixtureDir,
    input,
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
      const {
        include: [include],
        exclude: [, exclude],
      } = transformFilterPatterns(plugin)
      if (!include || !exclude) expect.unreachable('expected the globs to be converted')
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

  test('matches the working directory literally, brackets included', async () => {
    // `[1]` in a directory name is not a character class: the globs are glob syntax, the
    // directory they are resolved against is not
    const cwd = copyFixture('lib[1]')
    try {
      const plugin = pandacssPlugin({cwd})
      const bundle = await rolldown({cwd, input: path.join(cwd, 'src/index.ts'), plugins: [plugin]})
      try {
        const {
          include: [include],
        } = transformFilterPatterns(plugin)
        expect(include?.test(`${cwd.replaceAll('\\', '/')}/src/index.ts`)).toBe(true)

        const {output} = await bundle.generate({format: 'esm'})
        expect(findEntryChunk(output).code).toContain('"color_brand"')
      } finally {
        await bundle.close()
      }
    } finally {
      rmSync(cwd, {recursive: true, force: true})
    }
  })

  test('accepts globs built with `path.join`/`path.resolve`, and roots', async () => {
    // Globs assembled from path segments use the platform's separators — backslashes on
    // Windows, which fast-glob would read as escapes — and an absolute one starts with the
    // drive. The exclude climbs to the filesystem root, which must end up as a single slash
    // (`/…`, `C:/…`), not a double one.
    const joinedDir = path.resolve(__dirname, 'fixtures/joined.local')
    const toRoot = '../'.repeat(joinedDir.split(path.sep).length + 2)
    const cwd = copyFixture(
      'joined',
      readFileSync(path.resolve(__dirname, 'fixtures/codegen/panda.config.ts'), 'utf-8').replace(
        "include: ['./src/**/*.ts'],\n  exclude: ['./src/**/*.test.ts'],",
        `include: [${JSON.stringify(path.join('.', 'src', '**', '*.ts'))}, ${JSON.stringify(path.join(joinedDir, 'src', '**', '*.ts'))}],\n  exclude: [${JSON.stringify(`${toRoot}tmp/**`)}],`,
      ),
    )
    try {
      const plugin = pandacssPlugin({cwd})
      const bundle = await rolldown({cwd, input: path.join(cwd, 'src/index.ts'), plugins: [plugin]})
      try {
        const {include, exclude} = transformFilterPatterns(plugin)
        const posixCwd = cwd.replaceAll('\\', '/')
        expect(include).toHaveLength(2)
        for (const pattern of include) {
          expect(pattern.test(`${posixCwd}/src/index.ts`)).toBe(true)
          expect(pattern.test(`${posixCwd}/other/index.ts`)).toBe(false)
        }
        const root = path.parse(cwd).root.replaceAll('\\', '/')
        expect(exclude[1]?.test(`${root}tmp/x.ts`)).toBe(true)
        expect(exclude[1]?.test(`${root}/tmp/x.ts`)).toBe(false)

        const {output} = await bundle.generate({format: 'esm'})
        expect(findEntryChunk(output).code).toContain('"color_brand"')
      } finally {
        await bundle.close()
      }
    } finally {
      rmSync(cwd, {recursive: true, force: true})
    }
  })

  test('supports brace alternation, and leaves the rest of the syntax to the handler', async () => {
    const braces = copyFixture('braces', withInclude('./src/**/*.{ts,tsx}'))
    try {
      const plugin = pandacssPlugin({cwd: braces})
      const bundle = await rolldown({
        cwd: braces,
        input: path.join(braces, 'src/index.ts'),
        plugins: [plugin],
      })
      try {
        const {
          include: [include],
        } = transformFilterPatterns(plugin)
        const posixCwd = braces.replaceAll('\\', '/')
        expect(include?.test(`${posixCwd}/src/index.ts`)).toBe(true)
        expect(include?.test(`${posixCwd}/src/index.tsx`)).toBe(true)
        expect(include?.test(`${posixCwd}/src/index.js`)).toBe(false)
        const {output} = await bundle.generate({format: 'esm'})
        expect(findEntryChunk(output).code).toContain('"color_brand"')
      } finally {
        await bundle.close()
      }
    } finally {
      rmSync(braces, {recursive: true, force: true})
    }

    // Extglobs, negated classes and brace ranges are beyond the converter (a `[!a]` class
    // would even become a RegExp class matching `!` or `a`), so the native filter only skips
    // declaration files and the handler decides with Panda's own matcher — which covers
    // `[!a]*.ts` (so `index.ts` is still rewritten) but not the brace range
    for (const [name, include, rewritten] of [
      ['extglob', './src/**/*.@(ts|tsx)', false],
      ['negated-class', './src/**/[!a]*.ts', true],
      ['brace-range', './src/**/index{1..3}.ts', false],
      // A globstar at a brace boundary: valid for Panda, beyond the converter. (Panda reads
      // `src/**` followed by `/index.ts` as needing a directory in between, so the fixture's
      // `src/index.ts` isn't covered by the second pattern — the point is the filter.)
      ['brace-globstar', './src/{**/*.ts,**/*.tsx}', true],
      ['brace-globstar-prefix', './{src/**,lib}/index.ts', false],
    ] as const) {
      const cwd = copyFixture(name, withInclude(include))
      try {
        const plugin = pandacssPlugin({cwd})
        const bundle = await rolldown({
          cwd,
          input: path.join(cwd, 'src/index.ts'),
          plugins: [plugin],
        })
        try {
          expect(transformFilterPatterns(plugin)).toEqual({
            include: [],
            exclude: [expect.any(RegExp)],
          })
          const {output} = await bundle.generate({format: 'esm'})
          expect(findEntryChunk(output).code.includes('"color_brand"')).toBe(rewritten)
        } finally {
          await bundle.close()
        }
      } finally {
        rmSync(cwd, {recursive: true, force: true})
      }
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

  test('counts pattern, config recipe and `token()` calls as Panda styles', async () => {
    // Panda's parse report only counts `css()`/`cva()`/`sva()` calls and JSX, so an entry that
    // only calls a pattern, a config recipe or `token()` must still get the CSS import — also
    // without the transform, whose rewrite would otherwise be the only sign of them
    for (const [file, className] of [
      ['pattern', '.gap_2'],
      ['recipe', '.button--tone_brand'],
      ['token', '--colors-brand'],
    ] as const) {
      for (const transform of [false, true]) {
        const output = await generate(
          {cwd: recipesFixtureDir, inject: true, transform},
          'esm',
          path.join(recipesFixtureDir, `src/${file}.ts`),
        )
        const entry = findEntryChunk(output)
        expect(
          entry.code.startsWith('import "./bundle.css";\n'),
          `${file}, transform: ${transform}`,
        ).toBe(true)
        if (!transform) {
          // The call stayed, so the generated runtime is bundled for it
          expect(
            entry.moduleIds.some((id) => id.replaceAll('\\', '/').includes('/styled-system/')),
          ).toBe(true)
        }
        expect(findAsset(output, 'bundle.css')).toContain(className)
      }
    }
  })

  test('drops the CSS import once a module stops using Panda styles', async () => {
    // A plugin instance outlives a build in watch mode, so which modules use Panda styles must
    // follow their current code, not what an earlier build saw
    const cwd = copyFixture('stops-styling')
    const entry = path.join(cwd, 'src/index.ts')
    const plugin = pandacssPlugin({cwd, inject: true})
    const build = async (): Promise<string> => {
      const bundle = await rolldown({cwd, input: entry, plugins: [plugin]})
      try {
        const {output} = await bundle.generate({format: 'esm'})
        return findEntryChunk(output).code
      } finally {
        await bundle.close()
      }
    }
    try {
      expect((await build()).startsWith('import "./bundle.css";\n')).toBe(true)
      writeFileSync(entry, "export const plain: string = 'no Panda styles here'\n")
      expect(await build()).not.toContain('bundle.css')
    } finally {
      rmSync(cwd, {recursive: true, force: true})
    }
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

  test('inserts the CSS load after the directive prologue, so CJS output stays strict', async () => {
    // A `require()` before `"use strict"` would end the directive prologue and turn strict
    // mode off for the whole chunk — silently, since the string stays valid code
    const output = await generate(
      {cwd: fixtureDir, inject: true},
      'cjs',
      path.join(fixtureDir, 'src/strict.ts'),
    )
    const {code} = findEntryChunk(output)
    expect(code.startsWith('"use strict";\nrequire("./bundle.css");\n')).toBe(true)

    // Observed, not inferred: `this` is only `undefined` in a plain call under strict mode
    const built = evaluateCommonJs(code)
    expect(built.isStrict()).toBe(true)
    expect(built.strictBox).toBe('display_flex')
    // The control: the same chunk with the load prepended before the directive runs sloppy
    expect(evaluateCommonJs(`require("./bundle.css");\n${code}`).isStrict()).toBe(false)
  })

  test('keeps `"use client"` the first statement of the chunk', async () => {
    // Directives other than `"use strict"` are read by tools (React Server Components
    // bundlers) that only look at the prologue
    const entry = path.join(fixtureDir, 'src/client.ts')
    const esm = findEntryChunk(await generate({cwd: fixtureDir, inject: true}, 'esm', entry))
    expect(esm.code.startsWith('"use client";\nimport "./bundle.css";\n')).toBe(true)
    const cjs = findEntryChunk(await generate({cwd: fixtureDir, inject: true}, 'cjs', entry))
    expect(cjs.code.startsWith('"use client";\nrequire("./bundle.css");\n')).toBe(true)
  })

  test('`exports.nodeCompat` emits the shims and injects the self-referential import', async () => {
    const output = await generate({cwd: fixtureDir, inject: true, exports: {nodeCompat: true}})

    expect(findEntryChunk(output).code).toContain('import "@fixtures/panda-basic/bundle.css";')
    expect(findAsset(output, 'bundle-css.js')).toContain('No-op shim for `bundle.css`')
    expect(findAsset(output, 'bundle-css.d.ts')).toContain('export {}')
  })

  test('keeps the injected import of a dot-prefixed `fileName` relative', async () => {
    // `import ".assets/bundle.css"` would resolve as a package named `.assets`
    for (const fileName of ['.bundle.css', '.assets/bundle.css']) {
      const output = await generate({cwd: fixtureDir, inject: true, fileName})
      expect(findEntryChunk(output).code.startsWith(`import "./${fileName}";\n`)).toBe(true)
      expect(findAsset(output, fileName)).toContain('color: var(--colors-brand)')
    }
  })

  test('normalizes `fileName`, and rejects one outside the output directory', async () => {
    const output = await generate({cwd: fixtureDir, inject: true, fileName: './styles.css'})
    expect(findEntryChunk(output).code.startsWith('import "./styles.css";\n')).toBe(true)
    expect(findAsset(output, 'styles.css')).toContain('color: var(--colors-brand)')

    for (const fileName of ['../styles.css', '/tmp/styles.css', 'assets/', '.']) {
      expect(() => pandacssPlugin({fileName}), fileName).toThrow(
        '`fileName` must name a file inside the output directory',
      )
    }
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

  test('ignores `lightningcss.cssModules`, which would rename the classes', async () => {
    // Panda names the classes, and the JavaScript already carries them; a CSS-modules pass
    // would rename them in the stylesheet only
    const output = await generate({cwd: fixtureDir, lightningcss: {cssModules: true}})
    const css = findAsset(output, 'bundle.css')
    expect(css).toContain('.color_brand {')
    expect(css).toContain('.inset_0 {')
    expect(findEntryChunk(output).code).toContain('"color_brand"')
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
    writeFileSync(runtimeFile, '// stale\n')
    rmSync(typesFile)

    // `transform: false` bundles the runtime, so the output proves the codegen ran before
    // rolldown loaded it
    const entry = await build({transform: false})
    expect(entry.code).not.toContain('// stale')
    const regenerated = readFileSync(runtimeFile, 'utf-8')
    expect(regenerated).not.toContain('// stale')
    expect(regenerated).toMatch(/\bcss\b/)
    expect(existsSync(typesFile)).toBe(true)
    // What Panda writes for this config, exactly: another build changes nothing
    await build({transform: false})
    expect(readFileSync(runtimeFile, 'utf-8')).toBe(regenerated)
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

  test(
    'runs before tsdown builds the CJS declarations, which run without the plugin',
    {timeout: 60_000},
    async () => {
      // For `format: 'cjs'` with declarations, tsdown 0.23 runs a separate declaration build
      // first, without the user plugins — so a codegen gated on this plugin's `buildStart`
      // would come too late for it. The first codegen runs from the awaited
      // `tsdownConfigResolved` hook instead, before any build: on a clean checkout (no
      // `styled-system` yet) the artifacts exist by the time the declarations are generated.
      const cwd = copyFixture('clean-cjs-dts')
      writeFileSync(
        path.join(cwd, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            module: 'preserve',
            moduleResolution: 'bundler',
            target: 'esnext',
            strict: true,
            declaration: true,
            isolatedDeclarations: true,
            skipLibCheck: true,
          },
          include: ['src'],
        }),
      )
      expect(existsSync(path.join(cwd, 'styled-system'))).toBe(false)
      try {
        await tsdownBuild({
          cwd,
          entry: ['src/index.ts'],
          format: ['cjs'],
          dts: true,
          outDir: 'dist',
          plugins: [pandacssPlugin({cwd})],
          logLevel: 'silent',
          publint: false,
        })
        expect(readFileSync(path.join(cwd, 'dist/index.d.cts'), 'utf-8')).toContain(
          'export declare const brandText: string;',
        )
        expect(readFileSync(path.join(cwd, 'dist/index.cjs'), 'utf-8')).toContain('"color_brand"')
        // The artifacts were written before the declaration build started
        const generatedAt = statSync(path.join(cwd, 'styled-system/css/index.js')).mtimeMs
        const declaredAt = statSync(path.join(cwd, 'dist/index.d.cts')).mtimeMs
        expect(generatedAt).toBeLessThanOrEqual(declaredAt)
      } finally {
        rmSync(cwd, {recursive: true, force: true})
      }
    },
  )
})

describe('esbuildTargetToLightningCSS', () => {
  test('resolves a browser named more than once to its lowest version', () => {
    // The CSS has to work in the oldest requested version, whatever the order of the targets
    const chrome61 = 61 << 16
    expect(esbuildTargetToLightningCSS(['chrome61', 'chrome120'])).toEqual({chrome: chrome61})
    expect(esbuildTargetToLightningCSS(['chrome120', 'chrome61'])).toEqual({chrome: chrome61})
    expect(esbuildTargetToLightningCSS(['chrome120', 'safari16', 'chrome61'])).toEqual({
      chrome: chrome61,
      safari: 16 << 16,
    })
  })
})

const conditionalCssExport = {
  types: './dist/bundle-css.d.ts',
  browser: './dist/bundle.css',
  style: './dist/bundle.css',
  node: './dist/bundle-css.js',
  default: './dist/bundle-css.js',
}

/**
 * A rolldown watcher over a fixture copy, with `experimental.incrementalBuild` (which reuses the
 * transforms of unchanged modules) and the plugin told about the output directory, like tsdown
 * tells it. `nextBuild()` resolves when the next build completes, and `builds` counts them.
 */
function startWatcher(cwd: string) {
  const outDir = path.join(cwd, 'dist')
  let settle: (() => void) | undefined
  let fail: ((error: Error) => void) | undefined
  const state = {builds: 0}
  const nextBuild = () =>
    new Promise<void>((resolve, reject) => {
      settle = resolve
      fail = reject
    })
  const plugin = pandacssPlugin({cwd, inject: true})
  plugin.api.setBuildContext({outDir})
  const watcher = watch({
    cwd,
    input: path.join(cwd, 'src/index.ts'),
    plugins: [plugin],
    output: {dir: outDir, format: 'esm'},
    experimental: {incrementalBuild: true},
  })
  watcher.on('event', (event) => {
    if (event.code === 'BUNDLE_END') void event.result.close()
    if (event.code === 'ERROR') fail?.(event.error)
    if (event.code === 'END') {
      state.builds++
      settle?.()
    }
  })
  return {
    state,
    nextBuild,
    readOutput: () => ({
      js: readFileSync(path.join(outDir, 'index.js'), 'utf-8'),
      css: readFileSync(path.join(outDir, 'bundle.css'), 'utf-8'),
    }),
    close: () => watcher.close(),
  }
}

/** Waits long enough for the watcher to pick up the files the last build registered. */
const settleWatcher = () => new Promise((resolve) => setTimeout(resolve, 500))

/**
 * Awaits a rebuild triggered by `change()`, repeating the change once if the watcher missed
 * the first one (file watchers on CI runners occasionally drop an event right after starting).
 */
async function rebuildAfter(nextBuild: Promise<void>, change: () => void): Promise<void> {
  change()
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 5_000))
  if ((await Promise.race([nextBuild, timeout])) === 'timeout') {
    change()
    await nextBuild
  }
}

describe('watch mode', () => {
  test(
    'a config change renames the classes in the JavaScript and the stylesheet together',
    {timeout: 60_000},
    async () => {
      // Changing the class name `prefix` (like `hash` or `separator`) rewrites every class
      // name without touching a single source file. The modules must be transformed again all
      // the same — even under rolldown's incremental build, which reuses the transforms of
      // the modules whose files did not change — or the output keeps the old names while the
      // stylesheet has the new ones, and nothing is styled.
      const cwd = copyFixture('watch')
      const configPath = path.join(cwd, 'panda.config.ts')
      const originalConfig = readFileSync(configPath, 'utf-8')
      const watcher = startWatcher(cwd)
      try {
        const firstBuild = watcher.nextBuild()
        await firstBuild
        const before = watcher.readOutput()
        expect(before.js).toContain('"color_brand"')
        expect(before.css).toContain('.color_brand {')

        // The config and its imports are watched, so the edit triggers a rebuild
        const secondBuild = watcher.nextBuild()
        await settleWatcher()
        await rebuildAfter(secondBuild, () =>
          writeFileSync(
            configPath,
            originalConfig.replace('presets: [],', "presets: [],\n  prefix: 'v2',"),
          ),
        )

        const after = watcher.readOutput()
        expect(after.js).toContain('"v2-color_brand"')
        expect(after.js).not.toContain('"color_brand"')
        expect(after.css).toContain('.v2-color_brand {')
        expect(after.css).not.toContain('.color_brand {')
      } finally {
        await watcher.close()
        rmSync(cwd, {recursive: true, force: true})
      }
    },
  )

  test(
    'a source added to an `include` directory reaches the stylesheet, without a rebuild loop',
    {timeout: 60_000},
    async () => {
      // The stylesheet covers every scanned source, imported or not, so the directories the
      // `include` globs are rooted in are watched for additions. Here that root is the package
      // itself, which also holds the generated `styled-system` and the output directory: the
      // build writes there on every run, and those writes must not trigger the next one.
      const cwd = copyFixture(
        'watch-additions',
        readFileSync(path.resolve(__dirname, 'fixtures/codegen/panda.config.ts'), 'utf-8').replace(
          "include: ['./src/**/*.ts'],\n  exclude: ['./src/**/*.test.ts'],",
          "include: ['./**/*.ts'],\n  exclude: ['./styled-system/**', './dist/**', './panda.config.ts'],",
        ),
      )
      const watcher = startWatcher(cwd)
      try {
        await watcher.nextBuild()
        expect(watcher.readOutput().css).not.toContain('.display_grid {')

        const secondBuild = watcher.nextBuild()
        await settleWatcher()
        // Not imported by the entry, only covered by `include`
        await rebuildAfter(secondBuild, () =>
          writeFileSync(
            path.join(cwd, 'src/added.ts'),
            "import {css} from '#styled-system/css'\n\nexport const grid: string = css({display: 'grid'})\n",
          ),
        )
        expect(watcher.readOutput().css).toContain('.display_grid {')

        // The rebuild wrote the output and (possibly) generated artifacts into the watched
        // root — and stops there
        const builds = watcher.state.builds
        await new Promise((resolve) => setTimeout(resolve, 1_500))
        expect(watcher.state.builds).toBe(builds)
      } finally {
        await watcher.close()
        rmSync(cwd, {recursive: true, force: true})
      }
    },
  )
})

/** The (never created) root of the package the hook tests write exports for. */
const packageRoot = path.resolve(os.tmpdir(), 'pandacss-tsdown-plugin-host-library')

/**
 * Runs the plugin's `tsdownConfig` hook against a tsdown user config, like tsdown does. The
 * config's `cwd` defaults to the package root, as tsdown's would when run from it.
 */
async function runTsdownConfigHook(
  config: UserConfig,
  options: Options = {inject: true, exports: {nodeCompat: true}},
): Promise<UserConfig> {
  config.cwd ??= packageRoot
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

type CustomExportsContext = Parameters<
  Extract<NonNullable<Extract<UserConfig['exports'], object>['customExports']>, Function>
>[1]

/**
 * The context tsdown passes to `customExports` after a build: the package (with the path of
 * its `package.json`, which tsdown always resolves) and the emitted chunks per format, here
 * the CSS asset carrying the resolved output directory.
 */
function createCustomExportsContext(
  packageJsonPath = path.join(packageRoot, 'package.json'),
  outDir?: string,
): CustomExportsContext {
  return {
    pkg: {packageJsonPath},
    chunks: outDir === undefined ? {} : {es: [{type: 'asset', fileName: 'bundle.css', outDir}]},
    isPublish: false,
  } as unknown as CustomExportsContext
}

const customExportsContext = createCustomExportsContext()

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

  test('writes the export subpath of a `./`-prefixed `fileName` without the prefix', async () => {
    const config = await runTsdownConfigHook(
      {exports: true},
      {exports: true, fileName: './styles.css'},
    )
    await expect(
      getCustomExports(config)({'.': './dist/index.mjs'}, customExportsContext),
    ).resolves.toEqual({'.': './dist/index.mjs', './styles.css': './dist/styles.css'})
  })

  test('resolves `outDir` against the package root, in any spelling', async () => {
    // `./dist`, an absolute directory and a nested one all end up relative to the directory
    // of the `package.json` the exports are written to, with POSIX separators — never
    // `././dist` or `.//abs/path/dist`
    for (const [outDir, expected] of [
      ['./dist', './dist/bundle.css'],
      [path.join(packageRoot, 'dist'), './dist/bundle.css'],
      [`lib${path.sep}esm`, './lib/esm/bundle.css'],
      ['.', './bundle.css'],
    ] as const) {
      const config = await runTsdownConfigHook({exports: true, outDir}, {exports: true})
      await expect(
        getCustomExports(config)({'.': './dist/index.mjs'}, customExportsContext),
      ).resolves.toEqual({'.': './dist/index.mjs', './bundle.css': expected})
    }
  })

  test('prefers the output directory the build resolved over the configured one', async () => {
    // `customExports` runs after the build, when the emitted CSS asset knows where tsdown
    // actually wrote it (tsdown resolves `outDir` against `cwd`, which need not be the package
    // root the exports are relative to)
    const config = await runTsdownConfigHook({exports: true, outDir: 'dist'}, {exports: true})
    const customExports = getCustomExports(config)
    await expect(
      customExports(
        {'.': './build/index.mjs'},
        createCustomExportsContext(
          path.join(packageRoot, 'package.json'),
          path.join(packageRoot, 'build'),
        ),
      ),
    ).resolves.toEqual({'.': './build/index.mjs', './bundle.css': './build/bundle.css'})

    // A `cwd` below the package root: the configured `outDir` is relative to `cwd`, the
    // export target to the package root
    const nested = await runTsdownConfigHook(
      {exports: true, outDir: 'dist', cwd: path.join(packageRoot, 'packages/ui')},
      {exports: true},
    )
    await expect(
      getCustomExports(nested)({'.': './packages/ui/dist/index.mjs'}, customExportsContext),
    ).resolves.toEqual({
      '.': './packages/ui/dist/index.mjs',
      './bundle.css': './packages/ui/dist/bundle.css',
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
