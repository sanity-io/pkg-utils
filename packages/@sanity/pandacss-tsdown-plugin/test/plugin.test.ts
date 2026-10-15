import {createHash} from 'node:crypto'
import fs, {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import vm from 'node:vm'
import {transform as transformCss} from 'lightningcss'
import {rolldown, watch, type OutputAsset, type OutputChunk, type Plugin} from 'rolldown'
import {transform as transformWithOxc} from 'rolldown/experimental'
import {build as tsdownBuild, type ResolvedConfig, type UserConfig} from 'tsdown'
import {describe, expect, test, vi} from 'vitest'
import {unwrapCascadeLayers} from '../src/cascadeLayers.ts'
import {directoryPattern} from '../src/directoryPattern.ts'
import {
  esbuildTargetToLightningCSS,
  PANDACSS_PLUGIN_OPTION_NAMES,
  pandacssPlugin,
  type LightningCSSOptions,
  type Options,
} from '../src/index.ts'
import {cascadeWinner, ruleLines, type CascadeElement} from './cascade.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/basic')
const fixtureEntry = path.join(fixtureDir, 'src/index.ts')
const recipesFixtureDir = path.resolve(__dirname, 'fixtures/recipes')
const cascadeLayersFixtureDir = path.resolve(__dirname, 'fixtures/cascade-layers')
const cascadeLayersFixtureEntry = path.join(cascadeLayersFixtureDir, 'src/index.ts')

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

test('depends on the Panda packages it imports, with `@pandacss/dev` as an optional peer', () => {
  // A project that installs `@pandacss/dev` (for `panda codegen` and the CLI) keeps a single
  // copy of it, and needs nothing else for the build
  const manifest: unknown = JSON.parse(
    readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
  )
  expect(manifest).toMatchObject({
    dependencies: {
      '@pandacss/compiler': expect.any(String),
      '@pandacss/transformer': expect.any(String),
    },
    peerDependencies: {'@pandacss/dev': '*', 'tsdown': expect.any(String)},
    peerDependenciesMeta: {'@pandacss/dev': {optional: true}},
  })
})

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
    expect(plugin.transform).toEqual({order: 'pre', handler: expect.any(Function)})

    const bundle = await rolldown({cwd: fixtureDir, input: fixtureEntry, plugins: [plugin]})
    try {
      // The config is loaded in the `options` hook, so the filter is in place before rolldown
      // reads the plugin's hooks
      expect(plugin.transform).toEqual({
        order: 'pre',
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
      // Module ids never spell out a `..` segment, while Panda's matcher covers the file
      ['dot-segment', './src/../src/**/*.ts', true],
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

  test('resolves a symlinked project root, like the module ids', async () => {
    // rolldown resolves symlinks by default, so the ids under a symlinked root (macOS's `/var`
    // and `/tmp`, a linked workspace) are real paths, which a filter built from the link would
    // never match. With `resolve.symlinks: false` they keep the link, which a filter built from
    // the real path would never match.
    const real = copyFixture('symlink-target')
    const link = path.resolve(__dirname, 'fixtures', 'symlink.local')
    rmSync(link, {recursive: true, force: true})
    symlinkSync(real, link, process.platform === 'win32' ? 'junction' : 'dir')
    try {
      for (const symlinks of [undefined, false]) {
        const bundle = await rolldown({
          cwd: link,
          input: path.join(link, 'src/index.ts'),
          plugins: [pandacssPlugin({cwd: link, inject: true})],
          ...(symlinks === undefined ? {} : {resolve: {symlinks}}),
        })
        try {
          const {output} = await bundle.generate({format: 'esm'})
          const entry = findEntryChunk(output)
          expect(entry.facadeModuleId).toBe(
            path.join(symlinks === false ? link : realpathSync(real), 'src/index.ts'),
          )
          expect(entry.code).toContain('"color_brand"')
          expect(entry.code.startsWith('import "./bundle.css";\n')).toBe(true)
          expect(findAsset(output, 'bundle.css')).toContain('.color_brand {')
        } finally {
          await bundle.close()
        }
      }

      // Under tsdown the driver is created in its `build:before` hook, before rolldown's
      // `options` hook runs
      await tsdownBuild({
        config: false,
        cwd: link,
        entry: ['src/index.ts'],
        format: ['esm'],
        outDir: 'dist',
        dts: false,
        inputOptions: {resolve: {symlinks: false}},
        plugins: [pandacssPlugin({cwd: link, inject: true})],
        logLevel: 'silent',
        publint: false,
      })
      const code = readFileSync(path.join(real, 'dist/index.mjs'), 'utf-8')
      expect(code).toContain('"color_brand"')
      expect(code.startsWith('import "./bundle.css";\n')).toBe(true)
      expect(readFileSync(path.join(real, 'dist/bundle.css'), 'utf-8')).toContain('.color_brand {')
    } finally {
      rmSync(link, {recursive: true, force: true})
      rmSync(real, {recursive: true, force: true})
    }
  })

  test("resolves a relative `cwd` against the host's working directory", async () => {
    // tsdown's `cwd` (or rolldown's) needn't be the process's, e.g. in workspaces
    const cwd = copyFixture('relative-cwd')
    const hostCwd = path.dirname(cwd)
    const input = path.join(cwd, 'src/index.ts')
    try {
      const fromContext = pandacssPlugin({cwd: path.basename(cwd)})
      fromContext.api.setBuildContext({cwd: hostCwd})
      const fromRolldown = pandacssPlugin({cwd: path.basename(cwd)})
      for (const plugin of [fromContext, fromRolldown]) {
        const bundle = await rolldown({cwd: hostCwd, input, plugins: [plugin]})
        try {
          const {output} = await bundle.generate({format: 'esm'})
          expect(findEntryChunk(output).code).toContain('"color_brand"')
        } finally {
          await bundle.close()
        }
      }
    } finally {
      rmSync(cwd, {recursive: true, force: true})
    }
  })

  test('keeps an overridden `outdir` inside the `include` globs out of the scan and the transform', async () => {
    // The plugin's `outdir` option sends the generated code into `src/generated`, which
    // `./src/**/*` covers. Without an `importMap`, Panda recognizes the calls imported from
    // there only when the override is part of the config it loaded.
    const cwd = copyFixture(
      'outdir-in-include',
      withInclude('./src/**/*').replace("  importMap: '#styled-system',\n", ''),
    )
    writeFileSync(
      path.join(cwd, 'src/index.ts'),
      "import {css} from './generated/css/index.js'\n\nexport const brandText: string = css({color: 'brand'})\n",
    )
    const plugin = pandacssPlugin({cwd, outdir: 'src/generated'})
    const warnings: string[] = []
    const bundle = await rolldown({
      cwd,
      input: path.join(cwd, 'src/index.ts'),
      plugins: [plugin],
      onLog(level, log) {
        if (level === 'warn') warnings.push(log.message)
      },
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      expect(existsSync(path.join(cwd, 'src/generated/css/index.js'))).toBe(true)
      expect(findEntryChunk(output).code).toContain('"color_brand"')
      expect(findAsset(output, 'bundle.css')).toContain('.color_brand {')

      // Every scanned source is watched: the sources, but nothing generated
      const watched = (await bundle.watchFiles).map((file) =>
        path.relative(cwd, file).replaceAll('\\', '/'),
      )
      expect(watched).toContain('src/index.ts')
      expect(watched.filter((file) => file.startsWith('src/generated/'))).toEqual([])
      expect(warnings.filter((message) => message.includes('generated'))).toEqual([])

      const posixCwd = cwd.replaceAll('\\', '/')
      const {exclude} = transformFilterPatterns(plugin)
      expect(
        exclude.some((pattern) => pattern.test(`${posixCwd}/src/generated/css/index.js`)),
      ).toBe(true)
      expect(exclude.some((pattern) => pattern.test(`${posixCwd}/src/index.ts`))).toBe(false)
    } finally {
      await bundle.close()
      rmSync(cwd, {recursive: true, force: true})
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

  test('extracts Panda JSX before another plugin lowers it', async () => {
    // A plugin listed first that lowers JSX into `React.createElement(Box, {color: 'brand'})`
    // hides the JSX Panda extracts styles from, so Panda's transform runs ahead of it
    const cwd = copyFixture(
      'jsx-lowered',
      readFileSync(path.resolve(__dirname, 'fixtures/codegen/panda.config.ts'), 'utf-8')
        .replace("include: ['./src/**/*.ts']", "include: ['./src/**/*.{ts,tsx}']")
        .replace(
          'presets: [],',
          "presets: [],\n  jsxFramework: 'react',\n  patterns: {box: {properties: {}, transform: (props: {color?: string}) => props}},",
        ),
    )
    writeFileSync(
      path.join(cwd, 'src/badge.tsx'),
      'import {Box} from \'#styled-system/jsx\'\n\nexport const badge = <Box color="brand">New</Box>\n',
    )
    const lowerJsx: Plugin = {
      name: 'lower-jsx',
      transform: {
        filter: {id: /\.tsx$/},
        async handler(code, id) {
          const result = await transformWithOxc(id, code, {jsx: {runtime: 'classic'}})
          return {code: result.code, map: result.map}
        },
      },
    }
    const bundle = await rolldown({
      cwd,
      input: path.join(cwd, 'src/badge.tsx'),
      external: [/^react/],
      plugins: [lowerJsx, pandacssPlugin({cwd, inject: true, transform: false})],
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      expect(findEntryChunk(output).code.startsWith('import "./bundle.css";\n')).toBe(true)
      expect(findAsset(output, 'bundle.css')).toContain('.color_brand {')
    } finally {
      await bundle.close()
      rmSync(cwd, {recursive: true, force: true})
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

  test('keeps the directive prologue on the string fallback, and warns about the sourcemap', async () => {
    // Without rolldown's native magic-string (another plugin's `options` hook turned it off),
    // the load is spliced into the code at the same offset
    const withoutNativeMagicString: Plugin = {
      name: 'without-native-magic-string',
      options: (inputOptions) => ({
        ...inputOptions,
        experimental: {...inputOptions.experimental, nativeMagicString: false},
      }),
    }
    const warnings: string[] = []
    const bundle = await rolldown({
      cwd: fixtureDir,
      input: path.join(fixtureDir, 'src/strict.ts'),
      plugins: [pandacssPlugin({cwd: fixtureDir, inject: true}), withoutNativeMagicString],
      onLog(level, log) {
        if (level === 'warn') warnings.push(log.message)
      },
    })
    try {
      const {output} = await bundle.generate({format: 'cjs', sourcemap: true})
      const {code} = findEntryChunk(output)
      expect(code.startsWith('"use strict";\nrequire("./bundle.css");\n')).toBe(true)
      expect(evaluateCommonJs(code).isStrict()).toBe(true)
      expect(warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('native magic-string is unavailable')]),
      )
    } finally {
      await bundle.close()
    }
  })

  test('emits the stylesheet an injected import loads, even when it ends up empty', async () => {
    // Without tokens, globals or a preflight, `css({})` extracts nothing, while the module
    // still counts as styled: the relative import must resolve to an (empty) file
    const cwd = copyFixture(
      'empty-stylesheet',
      `import {defineConfig, type Config} from '@pandacss/dev'\n\nexport default defineConfig({\n  presets: [],\n  preflight: false,\n  include: ['./src/**/*.ts'],\n  outdir: 'styled-system',\n  outExtension: 'js',\n  importMap: '#styled-system',\n} satisfies Config)\n`,
    )
    writeFileSync(
      path.join(cwd, 'src/index.ts'),
      "import {css} from '#styled-system/css'\n\nexport const empty: string = css({})\n",
    )
    try {
      const bundle = await rolldown({
        cwd,
        input: path.join(cwd, 'src/index.ts'),
        plugins: [pandacssPlugin({cwd, inject: true})],
      })
      try {
        const {output} = await bundle.generate({format: 'esm'})
        expect(findEntryChunk(output).code.startsWith('import "./bundle.css";\n')).toBe(true)
        expect(findAsset(output, 'bundle.css').trim()).toBe('')
      } finally {
        await bundle.close()
      }
    } finally {
      rmSync(cwd, {recursive: true, force: true})
    }
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

  test('reads `lightningcss` when it emits the stylesheet', async () => {
    // `@sanity/tsdown-config` sets `targets` from the final config after creating the plugin,
    // before the build starts; chrome61 predates the `inset` shorthand
    const lightningcss: LightningCSSOptions = {}
    const plugin = pandacssPlugin({cwd: fixtureDir, lightningcss})
    lightningcss.targets = {chrome: 61 << 16}
    const bundle = await rolldown({cwd: fixtureDir, input: fixtureEntry, plugins: [plugin]})
    try {
      const {output} = await bundle.generate({format: 'esm'})
      expect(findAsset(output, 'bundle.css')).not.toContain('inset:')
    } finally {
      await bundle.close()
    }
  })

  test("expands tsdown's `baseline-widely-available` alias in `target`", async () => {
    // Its browsers (Chrome 111, Safari 16.4) predate `light-dark()`, which an unexpanded alias
    // (naming no browsers, so no syntax transform) would leave alone
    const cwd = copyFixture('baseline-target')
    writeFileSync(
      path.join(cwd, 'src/index.ts'),
      "import {css} from '#styled-system/css'\n\nexport const themed: string = css({color: 'light-dark(#000, #fff)'})\n",
    )
    try {
      for (const [target, transformed] of [
        ['baseline-widely-available', true],
        [false, false],
      ] as const) {
        const bundle = await rolldown({
          cwd,
          input: path.join(cwd, 'src/index.ts'),
          plugins: [pandacssPlugin({cwd, target})],
        })
        try {
          const {output} = await bundle.generate({format: 'esm'})
          expect(findAsset(output, 'bundle.css').includes('light-dark('), String(target)).toBe(
            !transformed,
          )
        } finally {
          await bundle.close()
        }
      }
    } finally {
      rmSync(cwd, {recursive: true, force: true})
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

describe('options', () => {
  test('`PANDACSS_PLUGIN_OPTION_NAMES` lists every option', () => {
    // A `Record` over the keys of `Options` has to name each of them, and nothing else
    const options: Record<keyof Options, true> = {
      cwd: true,
      configPath: true,
      codegen: true,
      outdir: true,
      transform: true,
      polyfill: true,
      cascadeLayers: true,
      fileName: true,
      minify: true,
      target: true,
      lightningcss: true,
      inject: true,
      exports: true,
    }
    expect([...PANDACSS_PLUGIN_OPTION_NAMES].toSorted()).toEqual(Object.keys(options).toSorted())
  })

  test('rejects an option it does not have, rather than ignoring it', () => {
    // A host newer than the plugin (`@sanity/tsdown-config`) may pass an option this version
    // doesn't know, which must not be dropped without a word; `undefined` is an option left out
    const unknown: Record<string, unknown> = {inject: true, keepLayers: ['reset']}
    expect(() => pandacssPlugin(unknown as Options)).toThrow(
      '`keepLayers` is not an option of this version of @sanity/pandacss-tsdown-plugin',
    )
    const unset: Record<string, unknown> = {inject: true, keepLayers: undefined}
    expect(() => pandacssPlugin(unset as Options)).not.toThrow()
  })

  test('rejects a `cascadeLayers` value it does not read, rather than keeping the layers', () => {
    // A later version may take the layers to keep; this one only knows `true` and `false`
    const keepList: Record<string, unknown> = {cascadeLayers: {keep: ['reset']}}
    expect(() => pandacssPlugin(keepList as Options)).toThrow(
      '`cascadeLayers` must be `true` or `false` in this version',
    )
  })
})

/** The stylesheet of the `cascade-layers` fixture, which has rules in every Panda layer. */
async function generateCascadeLayersCss(options: Options = {}): Promise<string> {
  const output = await generate(
    {cwd: cascadeLayersFixtureDir, ...options},
    'esm',
    cascadeLayersFixtureEntry,
  )
  return findAsset(output, 'bundle.css')
}

/**
 * Every selector of a stylesheet's style rules paired with each of the rule's declarations, and
 * the names of its `@keyframes`: what a stylesheet styles, regardless of its layers.
 */
function styledDeclarations(css: string): Set<string> {
  const declarations = new Set<string>()
  transformCss({
    filename: 'bundle.css',
    code: new TextEncoder().encode(css),
    visitor: {
      Rule: {
        style(rule) {
          const {declarations: block, selectors} = rule.value
          const all = [
            ...(block?.declarations ?? []),
            ...(block?.importantDeclarations ?? []).map((declaration) => ({
              important: declaration,
            })),
          ]
          for (const selector of selectors) {
            for (const declaration of all) {
              declarations.add(`${JSON.stringify(selector)} ${JSON.stringify(declaration)}`)
            }
          }
        },
        keyframes(rule) {
          declarations.add(`@keyframes ${JSON.stringify(rule.value.name)}`)
        },
      },
    },
  })
  return declarations
}

/** A consumer stylesheet, loaded after the library's: an element rule and a one-class override. */
const consumerCss = `button {
  color: red;
  font-weight: 400;
}

.override {
  color: green;
  outline-width: 0;
}
`

const hovered = {'data-hover': ''}

/** The {@link cascadeWinner} with a library stylesheet, then {@link consumerCss}. */
function consumerCascadeWinner(
  css: string,
  element: CascadeElement,
  property: string,
): string | undefined {
  return cascadeWinner(
    [
      ['library', css],
      ['consumer', consumerCss],
    ],
    element,
    property,
  )
}

describe('`cascadeLayers: false`', () => {
  test('removes every `@layer` block and statement, and keeps every rule as Panda wrote it', async () => {
    const layered = await generateCascadeLayersCss()
    const unlayered = await generateCascadeLayersCss({cascadeLayers: false})

    for (const layer of ['reset', 'base', 'tokens', 'recipes', 'recipes.slots', 'utilities']) {
      expect(layered).toContain(`@layer ${layer} {`)
    }
    expect(layered).toContain('@layer compositions {')
    expect(unlayered).not.toContain('@layer')
    // The same selectors, so the same specificity, with the same declarations
    expect(styledDeclarations(unlayered)).toEqual(styledDeclarations(layered))
    expect(unlayered).not.toContain('--made-with-panda')
  })

  test("orders the rules like the layers did, sublayers before their layer's own rules", async () => {
    // Each rule is matched at the start of a line
    const css = `\n${await generateCascadeLayersCss({cascadeLayers: false})}`
    const positions = [
      // reset
      '\nhtml, :host {',
      '\n@supports',
      // base
      '\nbutton {',
      // tokens
      '\n:where(:root, :host) {',
      '\n@keyframes spin {',
      // recipes: the `base`, `variants` and `compound_variants` sublayers, then `recipes.slots`
      '\n.button {',
      '\n.button:is(:focus-visible, [data-focus-visible]) {',
      '\n.button--size_lg {',
      '\n.button--compound__size_lg__tone_brand {',
      '\n.card__root {',
      '\n.card__root--tone_brand {',
      // utilities: `compositions`, which Panda emits last, comes before the utilities it loses to
      '\n.textStyle_body {',
      '\n.animation_spin_1s {',
      '\n.font-weight_300 {',
      '\n@media (width >= 48rem) {',
    ].map((rule) => {
      expect(css).toContain(rule)
      return css.indexOf(rule)
    })
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
  })

  test('keeps the precedence of utilities over recipes and the base, and within recipes', async () => {
    const layered = await generateCascadeLayersCss()
    const unlayered = await generateCascadeLayersCss({cascadeLayers: false})
    const brandLarge = [
      'button',
      'button--size_lg',
      'button--tone_brand',
      'button--compound__size_lg__tone_brand',
    ]
    for (const css of [layered, unlayered]) {
      const winner = (element: CascadeElement, property: string) =>
        cascadeWinner([['library', css]], element, property)
      // A variant beats the recipe's base, and a compound variant the variants
      expect(winner({tag: 'button', classes: ['button', 'button--tone_brand']}, 'color')).toBe(
        'library: .button--tone_brand',
      )
      expect(winner({tag: 'button', classes: brandLarge}, 'font-weight')).toBe(
        'library: .button--compound__size_lg__tone_brand',
      )
      // A utility beats all of them, the base layer's global style and a text style
      expect(winner({tag: 'button', classes: [...brandLarge, 'color_ink']}, 'color')).toBe(
        'library: .color_ink',
      )
      expect(
        winner({tag: 'button', classes: [...brandLarge, 'font-weight_300']}, 'font-weight'),
      ).toBe('library: .font-weight_300')
      expect(winner({tag: 'button', classes: ['font-weight_300']}, 'font-weight')).toBe(
        'library: .font-weight_300',
      )
      expect(winner({tag: 'p', classes: ['textStyle_body', 'font-size_12px']}, 'font-size')).toBe(
        'library: .font-size_12px',
      )
    }
  })

  test("lets a recipe's base state beat its variants and utilities, which only layers prevent", async () => {
    // Without layers, specificity decides before source order: the base `_hover` style
    // (`.button:is(:hover, [data-hover])`, 0-2-0) beats a variant or utility (0-1-0), where the
    // later `variants` and `utilities` layers made those win
    const layered = await generateCascadeLayersCss()
    const unlayered = await generateCascadeLayersCss({cascadeLayers: false})
    for (const classes of [
      ['button', 'button--tone_brand'],
      ['button', 'color_ink'],
    ]) {
      const element = {tag: 'button', classes, attributes: hovered}
      expect(cascadeWinner([['library', layered]], element, 'color')).toBe(
        `library: .${classes[1]}`,
      )
      expect(cascadeWinner([['library', unlayered]], element, 'color')).toBe(
        'library: .button:is(:hover, [data-hover])',
      )
    }
  })

  test("lets consumer CSS override the library's base styles, but not its states", async () => {
    const layered = await generateCascadeLayersCss()
    const unlayered = await generateCascadeLayersCss({cascadeLayers: false})
    const winner = consumerCascadeWinner
    const selectedButton = {
      tag: 'button',
      classes: ['button'],
      attributes: {'aria-selected': 'true'},
    }
    const hoveredButton = {tag: 'button', classes: ['button'], attributes: hovered}
    const focusedOverride = {
      tag: 'button',
      classes: ['button', 'override'],
      attributes: {'data-focus-visible': ''},
    }

    // An unlayered `button {…}` (Tailwind's preflight is one) beats the base layer's global
    // `button` style, which is no more specific and comes first…
    expect(winner(unlayered, {tag: 'button'}, 'font-weight')).toBe('consumer: button')
    // …but neither the recipe's `:hover` nor its selected state, which are more specific
    expect(winner(unlayered, hoveredButton, 'color')).toBe(
      'library: .button:is(:hover, [data-hover])',
    )
    expect(winner(unlayered, selectedButton, 'font-weight')).toBe(
      'library: .button:is([aria-selected="true"], [data-selected])',
    )
    // A one-class override (`styled(Button)`) beats the recipe's base, but not its states
    expect(winner(unlayered, {tag: 'button', classes: ['button', 'override']}, 'color')).toBe(
      'consumer: .override',
    )
    expect(
      winner(
        unlayered,
        {tag: 'button', classes: ['button', 'override'], attributes: hovered},
        'color',
      ),
    ).toBe('library: .button:is(:hover, [data-hover])')
    expect(winner(unlayered, focusedOverride, 'outline-width')).toBe(
      'library: .button:is(:focus-visible, [data-focus-visible])',
    )

    // With layers, unlayered consumer CSS beats every rule of the library, its states included:
    // the hover color, the selected weight and the focus ring are lost
    expect(winner(layered, hoveredButton, 'color')).toBe('consumer: button')
    expect(winner(layered, selectedButton, 'font-weight')).toBe('consumer: button')
    expect(winner(layered, focusedOverride, 'outline-width')).toBe('consumer: .override')
  })

  test("is what Panda's `polyfill` is not: it raises the specificity of every rule", async () => {
    // The polyfill emulates the layer order with `:not(#\#)` chains — one more ID for each
    // layer — so the library keeps its own precedence, and consumers can't override its base
    const polyfilled = await generateCascadeLayersCss({polyfill: true})
    expect(polyfilled).not.toContain('@layer')
    expect(polyfilled).toContain('\nbutton:not(#\\#) {')
    expect(polyfilled).toContain('\n.button:not(#\\##\\##\\#) {')
    expect(consumerCascadeWinner(polyfilled, {tag: 'button'}, 'font-weight')).toBe(
      'library: button:not(#\\#)',
    )
    const override = {tag: 'button', classes: ['button', 'override']}
    expect(consumerCascadeWinner(polyfilled, override, 'color')).toBe(
      'library: .button:not(#\\##\\##\\#)',
    )
  })

  test("cannot be combined with `polyfill: true`, and wins over the Panda config's", async () => {
    expect(() => pandacssPlugin({cascadeLayers: false, polyfill: true})).toThrow(
      'Set only one of them',
    )

    const cwd = copyFixture(
      'config-polyfill',
      readFileSync(path.resolve(__dirname, 'fixtures/codegen/panda.config.ts'), 'utf-8').replace(
        'presets: [],',
        'presets: [],\n  polyfill: true,',
      ),
    )
    try {
      const input = path.join(cwd, 'src/index.ts')
      const polyfilled = findAsset(await generate({cwd}, 'esm', input), 'bundle.css')
      expect(polyfilled).toContain('.color_brand:not(#\\#')
      const unlayered = findAsset(
        await generate({cwd, cascadeLayers: false}, 'esm', input),
        'bundle.css',
      )
      expect(unlayered).toContain('.color_brand {')
      expect(unlayered).not.toContain(':not(#')
      expect(unlayered).not.toContain('@layer')
    } finally {
      rmSync(cwd, {recursive: true, force: true})
    }
  })

  test('works with `minify`, `target`, `inject` and `exports`', async () => {
    const output = await generate(
      {
        cwd: cascadeLayersFixtureDir,
        cascadeLayers: false,
        minify: true,
        target: 'chrome61',
        inject: true,
        exports: {nodeCompat: true},
      },
      'esm',
      cascadeLayersFixtureEntry,
    )
    const css = findAsset(output, 'bundle.css')
    expect(css).not.toContain('@layer')
    expect(css.trimEnd()).not.toContain('\n')
    // chrome61 predates media query ranges and `:is()`, which lightningcss lowered
    expect(css).toContain('@media (min-width:48rem)')
    expect(css).toContain('.button:-webkit-any(:hover,[data-hover])')
    const positions = [
      'button{font-weight:600}',
      '.button{',
      '.button--tone_brand{',
      '.textStyle_body{',
      '.color_ink{',
    ].map((rule) => {
      expect(css).toContain(rule)
      return css.indexOf(rule)
    })
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
    const hoveredOverride = {tag: 'button', classes: ['button', 'override'], attributes: hovered}
    expect(consumerCascadeWinner(css, hoveredOverride, 'color')).toBe(
      'library: .button:is(:hover,[data-hover])',
    )

    expect(findEntryChunk(output).code).toContain(
      'import "@fixtures/panda-cascade-layers/bundle.css";',
    )
    expect(findAsset(output, 'bundle-css.js')).toContain('No-op shim for `bundle.css`')
  })

  test('removes the layers after lightningcss, whose visitors see the layered stylesheet', async () => {
    // The layers go last, from the final CSS: lightningcss (and the `lightningcss.visitor` of
    // the options) still processes Panda's output as Panda wrote it, layers included
    const visited: string[] = []
    const css = await generateCascadeLayersCss({
      cascadeLayers: false,
      lightningcss: {
        visitor: {
          Rule: {
            'layer-block'() {
              visited.push('layer-block')
            },
            'style'() {
              visited.push('style')
            },
          },
        },
      },
    })
    expect(visited).toContain('style')
    expect(visited).toContain('layer-block')
    expect(css).not.toContain('@layer')
  })

  test('keeps every line as lightningcss printed it, at the indentation of its new depth', async () => {
    const layered = await generateCascadeLayersCss()
    const unlayered = await generateCascadeLayersCss({cascadeLayers: false})
    // The same selector and declaration lines, text for text: only the `@layer` lines (and
    // their closing braces) are gone, and the indentation differs
    expect(ruleLines(unlayered)).toEqual(ruleLines(layered))
    // Rules that were nested in a layer block sit at the top level now, with their
    // declarations indented once, in lightningcss's own style: an empty line between rules
    expect(unlayered).toContain('\nbutton {\n  font-weight: 600;\n}\n\n')
    expect(unlayered).toContain(
      '\n@media (width >= 48rem) {\n  .md\\:font-size_24px {\n    font-size: 24px;\n  }\n}\n',
    )
    expect(unlayered.startsWith('html, :host {\n  ')).toBe(true)
    expect(unlayered.endsWith('}\n')).toBe(true)
  })
})

describe('unwrapCascadeLayers', () => {
  test("emits a layer's sublayers before its own rules, and the unlayered rules last", () => {
    expect(
      unwrapCascadeLayers(
        '.top{a:1}@layer a{.a1{a:1}@layer b{.b{a:1}}.a2{a:1}}@layer a.c{.c{a:1}}@layer a{@layer b{.b2{a:1}}}',
      ),
    ).toBe('.b{a:1}.b2{a:1}.c{a:1}.a1{a:1}.a2{a:1}.top{a:1}')
  })

  test('orders the layers by their first declaration, statements included', () => {
    expect(unwrapCascadeLayers('@layer z, y.x;@layer y{.y{}}@layer y.x{.x{}}@layer z{.z{}}')).toBe(
      '.z{}.x{}.y{}',
    )
  })

  test('keeps every anonymous layer a layer of its own', () => {
    expect(unwrapCascadeLayers('@layer{.a{}}@layer named{.n{}}@layer{.b{}}')).toBe('.a{}.n{}.b{}')
    expect(unwrapCascadeLayers('@layer x{.x{}@layer{.a{}}}')).toBe('.a{}.x{}')
  })

  test("keeps a layer's rules ahead of its own across a conditional rule", () => {
    // `utilities.compositions` loses to `utilities` when printing too: blue wins
    expect(
      unwrapCascadeLayers(
        '@layer utilities{.x{color:blue}@media print{@layer compositions{.x{color:red}}}}',
      ),
    ).toBe('@media print{.x{color:red}}.x{color:blue}')
  })

  test('orders a layer split across conditional and unconditional blocks as one', () => {
    // `a` comes before `b`, also for the rules of `a` in `@media print`: blue wins
    expect(
      unwrapCascadeLayers(
        '@layer a, b;@media print{@layer a{.x{color:red}}}@layer b{.x{color:blue}}',
      ),
    ).toBe('@media print{.x{color:red}}.x{color:blue}')
    expect(
      unwrapCascadeLayers(
        '@layer b{.x{color:blue}}@layer a{.y{}}@media print{@layer b{.x{color:red}}@layer a{.z{}}}',
      ),
    ).toBe('.x{color:blue}@media print{.x{color:red}}.y{}@media print{.z{}}')
  })

  test('splits a conditional rule across the layers of its rules, in copies of it', () => {
    expect(
      unwrapCascadeLayers(
        '@layer u{@supports (display:grid){@media print{.p{} @layer s{.s{}} .q{}}}@layer t{.t{}}.u{}}',
      ),
    ).toBe(
      '@supports (display:grid){@media print{.s{}}}.t{}@supports (display:grid){@media print{.p{} .q{}}}.u{}',
    )
    // Parts that end up next to each other share a copy
    expect(unwrapCascadeLayers('@layer u{@media print{.p{}@layer s{.s{}}}}')).toBe(
      '@media print{.s{}.p{}}',
    )
    // A block without layers stays as it is
    expect(unwrapCascadeLayers('@layer u{@media print{ .p{} }}')).toBe('@media print{ .p{} }')
  })

  test('splits a style rule with a nested layer the same way', () => {
    // The rule's own declarations, in `a`, beat those of its nested layer, `a.s`: red wins.
    // Both parts land next to each other, so they share one copy of the rule.
    expect(unwrapCascadeLayers('@layer a{.n{color:red;@layer s{color:blue}}}')).toBe(
      '.n{color:blue;color:red}',
    )
    expect(unwrapCascadeLayers('@layer a{.n{@layer s{color:blue}color:red}@layer t{.t{}}}')).toBe(
      '.n{color:blue}.t{}.n{color:red}',
    )
    expect(unwrapCascadeLayers('@layer a{.n{@media print{color:blue;@layer s{color:red}}}}')).toBe(
      '.n{@media print{color:red;color:blue}}',
    )
  })

  test('only reads braces and semicolons outside strings, comments, escapes and urls', () => {
    const rules = [
      '.a\\{b{content:"}{;";background:url(data:image/svg+xml;utf8,<svg>{</svg>)}',
      "/* } @layer x; { */.c[title='@layer y{']{d:e}",
      '.f{background:url( "a;b}.png" )}',
      ':is(.g, .h){--x:fn(a;b)}',
      '.i/*@layer x{*/{content:"\\"}"}',
    ].join('')
    expect(unwrapCascadeLayers(`@layer a{${rules}}`)).toBe(rules)
  })

  test('keeps custom property values opaque, `@layer` in them included', () => {
    const css = ':root{--rules:{@layer theme{color:red}};--color:blue}'
    expect(unwrapCascadeLayers(css)).toBe(css)
    expect(unwrapCascadeLayers(`@layer a{${css}}`)).toBe(css)
    // A value that ends its block, one with nested blocks, and one with braces in a comment
    expect(unwrapCascadeLayers('@layer a{.v{--x:{@layer t{a:b}}}}')).toBe('.v{--x:{@layer t{a:b}}}')
    expect(unwrapCascadeLayers('@layer a{.v{--x:{a:{b:{@layer t{}}}}}}')).toBe(
      '.v{--x:{a:{b:{@layer t{}}}}}',
    )
    expect(unwrapCascadeLayers('@layer a{.v{--x: /* } */ {a:b};top:0}}')).toBe(
      '.v{--x: /* } */ {a:b};top:0}',
    )
    // Next to a nested layer, the value goes along as it is
    expect(
      unwrapCascadeLayers('@layer a{.n{--v:{@layer z{}};color:red;@layer s{color:blue}}}'),
    ).toBe('.n{color:blue;--v:{@layer z{}};color:red}')
    // `a:hover {…}` is a nested rule, not a declaration
    expect(unwrapCascadeLayers('@layer a{.n{a:hover{@layer s{color:blue}}}}')).toBe(
      '.n{a:hover{color:blue}}',
    )
  })

  test('reads a custom property with a comment between its name and colon as one', () => {
    // The text scanner this replaced looked for `--name:` and read the value as nested rules
    // when a comment sat in between, so `@layer data` was unwrapped out of the value
    const css = '.n{--v /**/: {@layer data{color:red}};color:green}'
    expect(unwrapCascadeLayers(`@layer a{${css}}`)).toBe(css)
    expect(unwrapCascadeLayers(`@layer a{.n{--v/**/ :{@layer data{color:red}}}}`)).toBe(
      '.n{--v/**/ :{@layer data{color:red}}}',
    )
  })

  test('reads a layer name with a comment around its dot as the same layer', () => {
    // `a/**/.b` is `a.b`: a comment is not part of either segment. The text scanner this
    // replaced turned it into a space, which made `a ` a layer of its own, so green beat the
    // later `c` layer.
    expect(
      unwrapCascadeLayers(
        '@layer a.b{.x{color:red}}@layer c{.x{color:blue}}@layer a/**/.b{.x{color:green}}',
      ),
    ).toBe('.x{color:red}.x{color:green}.x{color:blue}')
    expect(
      unwrapCascadeLayers('@layer a./**/b, c;@layer c{.x{color:blue}}@layer a.b{.x{color:red}}'),
    ).toBe('.x{color:red}.x{color:blue}')
  })

  test('tells an escaped dot in a layer name from a sublayer', () => {
    // `a\.b` is one layer named `a.b`, not `b` inside `a`
    expect(
      unwrapCascadeLayers('@layer a\\.b{.x{color:red}}@layer a.b{.y{}}@layer a\\.b{.z{}}'),
    ).toBe('.x{color:red}.z{}.y{}')
  })

  test('ignores an invalid `@layer` rule, like a browser does', () => {
    // A name list in a block, or two identifiers without a separator, is no layer at all;
    // lightningcss rejects both before the plugin gets here
    expect(unwrapCascadeLayers('@layer a, b{.x{}}.y{}')).toBe('.y{}')
    expect(unwrapCascadeLayers('@layer a b{.x{}}@layer c{.c{}}')).toBe('.c{}')
    // Case-insensitive at-keyword, case-sensitive names
    expect(unwrapCascadeLayers('@LAYER A{.x{}}@layer a{.y{}}@LAYER A{.z{}}')).toBe('.x{}.z{}.y{}')
  })

  test('tells escaped commas in layer names apart', () => {
    // `a\,b` and `a\,c` are two layers: blue, in the later one, wins
    expect(
      unwrapCascadeLayers(
        '@layer a\\,b{.x{color:red}}@layer a\\,c{.x{color:blue}}@layer a\\,b{.x{color:green}}',
      ),
    ).toBe('.x{color:red}.x{color:green}.x{color:blue}')
    // `a\2c b` is `a\,b` with a hexadecimal escape, in a block and in a statement
    expect(
      unwrapCascadeLayers(
        '@layer a\\,b{.x{color:red}}@layer a\\,c{.x{color:blue}}@layer a\\2c b{.x{color:green}}',
      ),
    ).toBe('.x{color:red}.x{color:green}.x{color:blue}')
    expect(
      unwrapCascadeLayers(
        '@layer a\\,c, a\\2C b;@layer a\\,b{.x{color:red}}@layer a\\,c{.x{color:blue}}',
      ),
    ).toBe('.x{color:blue}.x{color:red}')
    // An escaped space is part of the name: `a\ ` isn't `a`
    expect(
      unwrapCascadeLayers('@layer a\\ {.x{color:red}}@layer b{.y{}}@layer a{.x{color:blue}}'),
    ).toBe('.x{color:red}.y{}.x{color:blue}')
  })

  test('resolves escapes in layer names', () => {
    expect(unwrapCascadeLayers('@layer u\\-a{.a{}}@layer b{.b{}}@layer u-a{.c{}}')).toBe(
      '.a{}.c{}.b{}',
    )
    expect(unwrapCascadeLayers('@layer \\75-a{.a{}}@layer b{.b{}}@layer u-a{.c{}}')).toBe(
      '.a{}.c{}.b{}',
    )
  })

  test('keeps `@charset`, `@import` and `@namespace` ahead of the other rules', () => {
    expect(
      unwrapCascadeLayers(
        '@charset "utf-8";@layer a;@import "x.css";@namespace svg url(x);.top{}@layer a{.a{}}',
      ),
    ).toBe('@charset "utf-8";@import "x.css";@namespace svg url(x);.a{}.top{}')
  })

  test('leaves a stylesheet without layers as it is', () => {
    const css = '.a {\n  color: red;\n}\n\n@media print {\n  .b {\n    color: blue;\n  }\n}\n'
    expect(unwrapCascadeLayers(css)).toBe(css)
    // Also when `@layer` only occurs as text
    const text = ':root {\n  --rules: {@layer x{}};\n}\n\n.c[title="@layer y{"] {\n  d: e;\n}\n'
    expect(unwrapCascadeLayers(text)).toBe(text)
  })

  test("indents a pretty-printed stylesheet in lightningcss's style, at the new depth", () => {
    expect(
      unwrapCascadeLayers(
        [
          '@layer reset {',
          '  html {',
          '    color: red;',
          '  }',
          '',
          '  @media print {',
          '    .p {',
          '      color: blue;',
          '    }',
          '  }',
          '}',
          '',
          '@layer base;',
          '',
          '@layer utilities {',
          '  .u {',
          '    color: red;',
          '    top: 0;',
          '  }',
          '',
          '  @layer compositions {',
          '    .c {',
          '      font-size: 1px;',
          '    }',
          '  }',
          '}',
          '',
          '.top {',
          '  color: green;',
          '}',
          '',
        ].join('\n'),
      ),
    ).toBe(
      [
        'html {',
        '  color: red;',
        '}',
        '',
        '@media print {',
        '  .p {',
        '    color: blue;',
        '  }',
        '}',
        '',
        '.c {',
        '  font-size: 1px;',
        '}',
        '',
        '.u {',
        '  color: red;',
        '  top: 0;',
        '}',
        '',
        '.top {',
        '  color: green;',
        '}',
        '',
      ].join('\n'),
    )
    // The indentation unit is the stylesheet's own
    expect(unwrapCascadeLayers('@layer a {\n\t.a {\n\t\tcolor: red;\n\t}\n}\n')).toBe(
      '.a {\n\tcolor: red;\n}\n',
    )
  })

  test('recognizes `@layer` in any case', () => {
    expect(unwrapCascadeLayers('@LAYER a{.a{}}.top{}')).toBe('.a{}.top{}')
    expect(unwrapCascadeLayers('@Layer a{.a{}}.top{}', new Set(['a']))).toBe('.a{}.top{}')
  })

  test('with dotted layer names, removes the layers their segments start with', () => {
    const layers = new Set(['panda.base'])
    expect(
      unwrapCascadeLayers(
        '@layer panda.reset, panda.base;@layer panda.base{@layer s{.s{}}.b{}}@layer panda.reset{.r{}}@layer base{.x{}}',
        layers,
      ),
    ).toBe('@layer panda.reset;.s{}.b{}@layer panda.reset{.r{}}@layer base{.x{}}')
    // Not a `base` block nested in a kept `panda` block
    const nested = '@layer panda{@layer base{.b{}}.p{}}'
    expect(unwrapCascadeLayers(nested, layers)).toBe(nested)
  })

  test('keeps the comments ahead of the first rule there', () => {
    expect(unwrapCascadeLayers('/* head */@layer a{.a{}}/* mid */.top{}')).toBe(
      '/* head */.a{}/* mid */.top{}',
    )
  })

  test('with layer names, removes only those layers, with their sublayers', () => {
    // `other.a` is a sublayer of a kept layer, which stays after the rules of the removed ones,
    // since they beat it now
    expect(
      unwrapCascadeLayers(
        '@layer a{@layer s{.s{}}.a{}}@layer other{@layer a{.oa{}}}@layer b{.b{}}.top{}',
        new Set(['a', 'b']),
      ),
    ).toBe('.s{}.a{}.b{}@layer other{@layer a{.oa{}}}.top{}')
  })

  test('with layer names, keeps the names of the other layers in the statements', () => {
    // A statement ahead of the first rule stays there, so it still names its layers first
    expect(
      unwrapCascadeLayers(
        '@layer sui, a;.x{}@layer b, other;@layer other{.o{}}@layer a{.a{}}@layer b{.b{}}',
        new Set(['a', 'b']),
      ),
    ).toBe('@layer sui;.a{}.b{}.x{}@layer other;@layer other{.o{}}')
    // Also when the statement ends up last
    expect(unwrapCascadeLayers('.x{}@layer a, other;@layer a{.a{}}', new Set(['a']))).toBe(
      '.a{}.x{}@layer other;',
    )
  })

  test('with layer names, only splits the conditional rules around those layers', () => {
    expect(
      unwrapCascadeLayers('@media print{@layer other{.o{}}@layer a{.a{}}}', new Set(['a'])),
    ).toBe('@media print{.a{}@layer other{.o{}}}')
    expect(
      unwrapCascadeLayers('@media print{@layer other{.o{}}}@layer a{.a{}}', new Set(['a'])),
    ).toBe('.a{}@media print{@layer other{.o{}}}')
  })

  test('with layer names, leaves a stylesheet without them as it is', () => {
    const css = '@layer other {\n  .o {\n    color: red;\n  }\n}\n\n@layer other.a;\n'
    expect(unwrapCascadeLayers(css, new Set(['a']))).toBe(css)
  })
})

/** Records the directories created with `fs.mkdtempSync` (by the plugin) and their modes. */
function spyOnTempDirs(): {created: {dir: string; mode: number}[]; restore(): void} {
  const createTempDir = fs.mkdtempSync
  const created: {dir: string; mode: number}[] = []
  const spy = vi.spyOn(fs, 'mkdtempSync').mockImplementation((prefix, options) => {
    const dir = createTempDir(prefix, options)
    created.push({dir, mode: statSync(dir).mode & 0o777})
    return dir
  })
  return {created, restore: () => spy.mockRestore()}
}

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

  // Creating a file symlink takes extra privileges on Windows
  test.skipIf(process.platform === 'win32')(
    '`outdir` leaves a pre-created temp path alone',
    async () => {
      // The config with the `outdir` override used to be written to a path derived from the
      // config and the override, which another user of a shared host could pre-create, with the
      // config a symlink to a file of the build user's
      const outdir = mkdtempSync(path.join(os.tmpdir(), 'pandacss-tsdown-plugin-outdir-'))
      const key = createHash('sha256')
        .update(`${path.join(codegenFixtureDir, 'panda.config.ts')}\0${outdir}`)
        .digest('hex')
        .slice(0, 16)
      const sharedDir = path.join(os.tmpdir(), 'sanity-pandacss-tsdown-plugin')
      const sharedDirExisted = existsSync(sharedDir)
      const predictableDir = path.join(sharedDir, key)
      const victim = path.join(outdir, 'victim.txt')
      try {
        writeFileSync(victim, 'not a Panda config\n')
        mkdirSync(predictableDir, {recursive: true})
        symlinkSync(victim, path.join(predictableDir, 'panda.config.mjs'))
        await build({outdir})
        expect(readFileSync(victim, 'utf-8')).toBe('not a Panda config\n')
        expect(existsSync(path.join(outdir, 'css/index.js'))).toBe(true)
      } finally {
        rmSync(sharedDirExisted ? predictableDir : sharedDir, {recursive: true, force: true})
        rmSync(outdir, {recursive: true, force: true})
      }
    },
  )

  test('`outdir` loads its config from a private temp directory, removed once loaded', async () => {
    const outdir = mkdtempSync(path.join(os.tmpdir(), 'pandacss-tsdown-plugin-outdir-'))
    const tempDirs = spyOnTempDirs()
    try {
      await build({outdir})
      expect(tempDirs.created).toHaveLength(1)
      const [created] = tempDirs.created
      if (!created) expect.unreachable('expected a temp directory')
      const {dir, mode} = created
      expect(path.basename(dir)).toMatch(/^sanity-pandacss-tsdown-plugin-/)
      if (process.platform !== 'win32') expect(mode).toBe(0o700)
      expect(existsSync(dir)).toBe(false)
      expect(existsSync(path.join(outdir, 'css/index.js'))).toBe(true)
    } finally {
      tempDirs.restore()
      rmSync(outdir, {recursive: true, force: true})
    }
  })

  test(
    'runs before tsdown builds the CJS declarations, which run without the plugin',
    {timeout: 60_000},
    async () => {
      // For `format: 'cjs'` with declarations, tsdown 0.23 runs a separate declaration build
      // next to the JS build, without the user plugins — so a codegen gated on this plugin's
      // `buildStart` would come too late for it. The first codegen runs from tsdown's awaited
      // `build:before` hook instead, after `clean` (which deletes the generated directory here)
      // and before any build: the artifacts exist by the time the declarations are generated.
      const cwd = copyFixture('clean-cjs-dts')
      writeFileSync(
        path.join(cwd, 'src/index.ts'),
        `${readFileSync(path.join(cwd, 'src/index.ts'), 'utf-8')}\nexport type {SystemStyleObject} from '#styled-system/types'\n`,
      )
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
          clean: ['dist', 'styled-system'],
          plugins: [pandacssPlugin({cwd})],
          logLevel: 'silent',
          publint: false,
        })
        const declarations = readFileSync(path.join(cwd, 'dist/index.d.cts'), 'utf-8')
        expect(declarations).toContain('export declare const brandText: string;')
        // The re-exported type was bundled from the generated declarations of this config
        expect(declarations).toContain('type ColorToken = "brand"')
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

  test(
    "runs after tsdown's `clean` step, ahead of the user's `build:before` hooks",
    {timeout: 60_000},
    async () => {
      // tsdown cleans after resolving the config, so a codegen before then is deleted again by
      // `clean: ['dist', 'styled-system']`. The user's hooks (object or function form) keep
      // running, and see the generated files.
      const cwd = copyFixture('clean-order')
      const generatedFile = path.join(cwd, 'styled-system/css/index.js')
      const staleFile = path.join(cwd, 'dist/stale.txt')
      try {
        for (const form of ['object', 'function'] as const) {
          mkdirSync(path.dirname(staleFile), {recursive: true})
          writeFileSync(staleFile, '')
          const observed: {generated: boolean; stale: boolean}[] = []
          const observe = (): void => {
            observed.push({generated: existsSync(generatedFile), stale: existsSync(staleFile)})
          }
          await tsdownBuild({
            config: false,
            cwd,
            entry: ['src/index.ts'],
            format: ['esm'],
            outDir: 'dist',
            clean: ['dist', 'styled-system'],
            hooks:
              form === 'object'
                ? {'build:before': observe}
                : (hooks) => {
                    hooks.hook('build:before', observe)
                  },
            plugins: [pandacssPlugin({cwd})],
            logLevel: 'silent',
            publint: false,
          })
          expect(observed, form).toEqual([{generated: true, stale: false}])
        }
      } finally {
        rmSync(cwd, {recursive: true, force: true})
      }
    },
  )

  test(
    'runs again for every tsdown build that reuses the plugin instance',
    {timeout: 60_000},
    async () => {
      // Each programmatic `build()` cleans the generated directory again, so the codegen the
      // first build ran must not stand in for the second's. `transform: false` bundles the
      // runtime, so a missing directory fails the build.
      const cwd = copyFixture('clean-twice')
      const plugin = pandacssPlugin({cwd, transform: false})
      try {
        for (const run of [1, 2]) {
          await tsdownBuild({
            config: false,
            cwd,
            entry: ['src/index.ts'],
            format: ['esm', 'cjs'],
            outDir: 'dist',
            clean: ['dist', 'styled-system'],
            plugins: [plugin],
            logLevel: 'silent',
            publint: false,
          })
          expect(existsSync(path.join(cwd, 'styled-system/css/index.js')), `build ${run}`).toBe(
            true,
          )
          expect(readFileSync(path.join(cwd, 'dist/index.mjs'), 'utf-8')).toMatch(/\bcss\(/)
        }
      } finally {
        rmSync(cwd, {recursive: true, force: true})
      }
    },
  )

  test("runs before every plugin's `buildStart`, outside tsdown too", async () => {
    // rolldown runs the `buildStart` hooks in parallel, and a declaration plugin reads the
    // generated types from its own, so the first codegen must be done before any of them
    const cwd = copyFixture('codegen-order')
    const seen: boolean[] = []
    const probe: Plugin = {
      name: 'probe',
      buildStart() {
        seen.push(existsSync(path.join(cwd, 'styled-system/css/index.js')))
      },
    }
    try {
      const bundle = await rolldown({
        cwd,
        input: path.join(cwd, 'src/index.ts'),
        plugins: [probe, pandacssPlugin({cwd})],
      })
      try {
        await bundle.generate({format: 'esm'})
      } finally {
        await bundle.close()
      }
      expect(seen).toEqual([true])
    } finally {
      rmSync(cwd, {recursive: true, force: true})
    }
  })
})

describe('directoryPattern', () => {
  test('matches a directory and everything in it, with either separator', () => {
    for (const [dir, inside, outside] of [
      [
        '/home/user/lib/dist',
        ['/home/user/lib/dist', '/home/user/lib/dist/index.js'],
        ['/home/user/lib/dist2/index.js', '/home/user/lib'],
      ],
      [
        'C:\\work\\lib\\dist',
        ['C:\\work\\lib\\dist\\index.js', 'C:/work/lib/dist/index.js'],
        ['C:\\work\\lib\\distx\\index.js'],
      ],
      // A UNC directory keeps its double leading separator, in either spelling
      [
        '\\\\server\\share\\lib\\dist',
        [
          '\\\\server\\share\\lib\\dist',
          '\\\\server\\share\\lib\\dist\\index.js',
          '//server/share/lib/dist/index.js',
        ],
        ['\\\\server\\share\\lib\\distx\\index.js', '\\\\server\\share\\lib\\index.js'],
      ],
    ] as const) {
      const pattern = directoryPattern(dir)
      for (const file of inside) expect(pattern.test(file), file).toBe(true)
      for (const file of outside) expect(pattern.test(file), file).toBe(false)
    }
  })
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
/**
 * Watches the project with a watcher per format, all sharing a plugin instance. rolldown runs
 * the builds of one watcher's configs one after the other, so the builds of separate watchers
 * are the ones that overlap. The ESM build writes to `dist`, which `readOutput` reads, and
 * `nextBuild` settles once every watcher finished a build.
 */
function startWatcher(
  cwd: string,
  options: Options = {},
  formats: readonly ('esm' | 'cjs')[] = ['esm'],
) {
  const outDir = path.join(cwd, 'dist')
  let settle: (() => void) | undefined
  let fail: ((error: Error) => void) | undefined
  let pending = 0
  const state = {builds: 0}
  const nextBuild = () =>
    new Promise<void>((resolve, reject) => {
      pending = formats.length
      settle = resolve
      fail = reject
    })
  const plugin = pandacssPlugin({cwd, inject: true, ...options})
  plugin.api.setBuildContext({outDir})
  const watchers = formats.map((format) =>
    watch({
      cwd,
      input: path.join(cwd, 'src/index.ts'),
      plugins: [plugin],
      output: {dir: format === 'esm' ? outDir : path.join(cwd, `dist-${format}`), format},
      experimental: {incrementalBuild: true},
    }),
  )
  for (const watcher of watchers) {
    watcher.on('event', (event) => {
      if (event.code === 'BUNDLE_END') void event.result.close()
      if (event.code === 'ERROR') fail?.(event.error)
      if (event.code === 'END') {
        state.builds++
        pending--
        if (pending <= 0) settle?.()
      }
    })
  }
  return {
    state,
    nextBuild,
    readOutput: () => ({
      js: readFileSync(path.join(outDir, 'index.js'), 'utf-8'),
      css: readFileSync(path.join(outDir, 'bundle.css'), 'utf-8'),
    }),
    close: () => Promise.all(watchers.map((watcher) => watcher.close())),
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
    '`cascadeLayers: false` unwraps the stylesheet of every rebuild',
    {timeout: 60_000},
    async () => {
      const cwd = copyFixture('watch-unlayered')
      const sourcePath = path.join(cwd, 'src/index.ts')
      const originalSource = readFileSync(sourcePath, 'utf-8')
      const watcher = startWatcher(cwd, {cascadeLayers: false})
      try {
        await watcher.nextBuild()
        const before = watcher.readOutput().css
        expect(before).toContain('.color_brand {')
        expect(before).not.toContain('@layer')

        const secondBuild = watcher.nextBuild()
        await settleWatcher()
        await rebuildAfter(secondBuild, () =>
          writeFileSync(
            sourcePath,
            `${originalSource}\nexport const later: string = css({display: 'flex'})\n`,
          ),
        )

        const after = watcher.readOutput().css
        expect(after).toContain('.display_flex {')
        expect(after).not.toContain('@layer')
      } finally {
        await watcher.close()
        rmSync(cwd, {recursive: true, force: true})
      }
    },
  )

  test('a change to a file the config imports reloads it', {timeout: 60_000}, async () => {
    // The config's own imports aren't part of the module graph, but its tokens can live there
    const cwd = copyFixture(
      'watch-config-import',
      readFileSync(path.resolve(__dirname, 'fixtures/codegen/panda.config.ts'), 'utf-8')
        .replace(
          "import {defineConfig, type Config} from '@pandacss/dev'",
          "import {defineConfig, type Config} from '@pandacss/dev'\nimport {brand} from './theme.ts'",
        )
        .replace("brand: {value: '#f03e2f'}", 'brand: {value: brand}'),
    )
    const themePath = path.join(cwd, 'theme.ts')
    writeFileSync(themePath, "export const brand: string = '#f03e2f'\n")
    const watcher = startWatcher(cwd)
    try {
      await watcher.nextBuild()
      expect(watcher.readOutput().css).toContain('--colors-brand: #f03e2f')

      const secondBuild = watcher.nextBuild()
      await settleWatcher()
      await rebuildAfter(secondBuild, () =>
        writeFileSync(themePath, "export const brand: string = '#0000ff'\n"),
      )
      expect(watcher.readOutput().css).toContain('--colors-brand: #00f')
    } finally {
      await watcher.close()
      rmSync(cwd, {recursive: true, force: true})
    }
  })

  test('a config reload keeps the `outdir` override', {timeout: 60_000}, async () => {
    // Without an `importMap`, the calls imported from the overridden directory are only
    // recognized while the override is part of the loaded config — also after a reload
    const cwd = copyFixture(
      'watch-outdir',
      readFileSync(path.resolve(__dirname, 'fixtures/codegen/panda.config.ts'), 'utf-8').replace(
        "  importMap: '#styled-system',\n",
        '',
      ),
    )
    writeFileSync(
      path.join(cwd, 'src/index.ts'),
      "import {css} from '../generated/css/index.js'\n\nexport const brandText: string = css({color: 'brand'})\n",
    )
    const configPath = path.join(cwd, 'panda.config.ts')
    const originalConfig = readFileSync(configPath, 'utf-8')
    const tempDirs = spyOnTempDirs()
    const watcher = startWatcher(cwd, {outdir: 'generated'})
    try {
      await watcher.nextBuild()
      expect(watcher.readOutput().js).toContain('"color_brand"')

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
      expect(after.css).toContain('.v2-color_brand {')
      // The reload read the override from the same private directory, removed again after it
      expect(tempDirs.created).toHaveLength(1)
      expect(existsSync(tempDirs.created[0]?.dir ?? '')).toBe(false)
    } finally {
      tempDirs.restore()
      await watcher.close()
      rmSync(cwd, {recursive: true, force: true})
    }
  })

  test(
    'overlapping builds share a config reload with the `outdir` override',
    {timeout: 60_000},
    async () => {
      // Every build reloads the config in watch mode, and builds sharing the plugin can run at
      // the same time: they share the reload, and with it the private directory of the override
      const cwd = copyFixture('watch-outdir-formats')
      const configPath = path.join(cwd, 'panda.config.ts')
      const originalConfig = readFileSync(configPath, 'utf-8')
      const watcher = startWatcher(cwd, {outdir: 'generated'}, ['esm', 'cjs'])
      try {
        await watcher.nextBuild()
        expect(watcher.readOutput().js).toContain('"color_brand"')

        // The watchers run their first codegen at the same time, and each one's writes may
        // rebuild the other once: let them settle before waiting for the next builds
        await settleWatcher()
        const secondBuild = watcher.nextBuild()
        await rebuildAfter(secondBuild, () =>
          writeFileSync(
            configPath,
            originalConfig.replace('presets: [],', "presets: [],\n  prefix: 'v2',"),
          ),
        )
        expect(watcher.readOutput().js).toContain('"v2-color_brand"')
        expect(readFileSync(path.join(cwd, 'dist-cjs/index.js'), 'utf-8')).toContain(
          '"v2-color_brand"',
        )

        // A source change reloads the config too
        await settleWatcher()
        const thirdBuild = watcher.nextBuild()
        await rebuildAfter(thirdBuild, () =>
          writeFileSync(
            path.join(cwd, 'src/index.ts'),
            "import {css} from '#styled-system/css'\n\nexport const brandText: string = css({color: 'brand', display: 'grid'})\n",
          ),
        )
        expect(watcher.readOutput().css).toContain('.v2-display_grid {')
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

  test('rejects an output directory outside the package', async () => {
    // `./../elsewhere/bundle.css` is not a valid export target, which Node rejects
    const config = await runTsdownConfigHook(
      {exports: true, outDir: '../elsewhere'},
      {exports: true},
    )
    await expect(
      getCustomExports(config)({'.': './dist/index.mjs'}, customExportsContext),
    ).rejects.toThrow('can only publish the stylesheet from inside the package')
  })

  test("keeps the entry a user's own `customExports` writes for the CSS subpath", async () => {
    const custom = {style: './dist/bundle.css', default: './dist/bundle.css'}
    for (const customExports of [
      (exportsMap: Record<string, unknown>) => ({...exportsMap, './bundle.css': custom}),
      {'./bundle.css': custom},
    ]) {
      const config = await runTsdownConfigHook({exports: {customExports}})
      await expect(
        getCustomExports(config)({'.': './dist/index.mjs'}, customExportsContext),
      ).resolves.toEqual({'.': './dist/index.mjs', './bundle.css': custom})
    }

    // An entry tsdown itself passed in is not the user's, and gets the CSS export
    const passedThrough = await runTsdownConfigHook({
      exports: {customExports: (exportsMap) => ({...exportsMap})},
    })
    await expect(
      getCustomExports(passedThrough)(
        {'.': './dist/index.mjs', './bundle.css': './dist/bundle.css'},
        customExportsContext,
      ),
    ).resolves.toEqual({'.': './dist/index.mjs', './bundle.css': conditionalCssExport})
  })

  test("keeps an entry the user's `customExports` returns, even tsdown's own", async () => {
    // The callback receives the CSS export, so writing back the entry tsdown passed in is an
    // explicit choice too
    const received: unknown[] = []
    const config = await runTsdownConfigHook({
      exports: {
        customExports: (exportsMap) => {
          received.push(exportsMap['./bundle.css'])
          return {...exportsMap, './bundle.css': './dist/bundle.css'}
        },
      },
    })
    await expect(
      getCustomExports(config)(
        {'.': './dist/index.mjs', './bundle.css': './dist/bundle.css'},
        customExportsContext,
      ),
    ).resolves.toEqual({'.': './dist/index.mjs', './bundle.css': './dist/bundle.css'})
    expect(received).toEqual([conditionalCssExport])
  })

  test("keeps a CSS entry the user's `customExports` changes in place", async () => {
    // A callback may mutate the map it receives and return it
    const replaced = await runTsdownConfigHook({
      exports: {
        customExports: (exportsMap) => {
          exportsMap['./bundle.css'] = {style: './dist/bundle.css', default: './dist/bundle.css'}
          return exportsMap
        },
      },
    })
    await expect(
      getCustomExports(replaced)({'.': './dist/index.mjs'}, customExportsContext),
    ).resolves.toEqual({
      '.': './dist/index.mjs',
      './bundle.css': {style: './dist/bundle.css', default: './dist/bundle.css'},
    })

    const nested = await runTsdownConfigHook({
      exports: {
        customExports: (exportsMap) => {
          const entry = exportsMap['./bundle.css']
          if (typeof entry === 'object' && entry !== null) {
            Reflect.set(entry, 'module', './dist/bundle.css')
          }
          return exportsMap
        },
      },
    })
    await expect(
      getCustomExports(nested)(
        {'.': './dist/index.mjs', './bundle.css': {default: './dist/bundle.css'}},
        customExportsContext,
      ),
    ).resolves.toEqual({
      '.': './dist/index.mjs',
      './bundle.css': {...conditionalCssExport, module: './dist/bundle.css'},
    })
  })

  test('leaves the config alone without `exports`, or when tsdown `exports` is off', async () => {
    const withoutCssExports = await runTsdownConfigHook({exports: true}, {inject: true})
    expect(withoutCssExports.exports).toBe(true)

    const withoutTsdownExports = await runTsdownConfigHook({})
    expect(withoutTsdownExports.exports).toBeUndefined()
  })
})
