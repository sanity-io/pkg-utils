import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {discoverCssModules} from '@sanity/vanilla-extract-integration'
import {rolldown, type OutputAsset, type OutputChunk} from 'rolldown'
import {describe, expect, test} from 'vitest'
import {vanillaExtractPlugin, type Options} from '../src/index.ts'
import {defaultProgramRoots, inputEntryFiles} from '../src/wholeProgram.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, 'fixtures')

async function buildFixture(fixture: string, options?: Options, format: 'esm' | 'cjs' = 'esm') {
  const logs: string[] = []
  const bundle = await rolldown({
    input: path.join(fixturesDir, fixture, 'index.ts'),
    plugins: [vanillaExtractPlugin(options)],
    onLog(_level, log) {
      logs.push(log.message)
    },
  })
  try {
    const {output} = await bundle.generate({format})
    return {output, logs}
  } finally {
    await bundle.close()
  }
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

/** The top-level rules of rendered CSS, in order. */
function topLevelRules(css: string): string[] {
  const rules: string[] = []
  let depth = 0
  let current: string[] = []
  for (const line of css.split('\n')) {
    if (!line && current.length === 0) continue
    current.push(line)
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length
    if (depth === 0) {
      rules.push(current.join('\n'))
      current = []
    }
  }
  return rules
}

describe('compilation: whole-program', () => {
  test('produces the same class names and JS as per-module compilation', async () => {
    const [perModule, wholeProgram] = await Promise.all([
      buildFixture('basic'),
      buildFixture('basic', {compilation: 'whole-program'}),
    ])

    expect(findEntryChunk(wholeProgram.output).code).toBe(findEntryChunk(perModule.output).code)
    expect(wholeProgram.logs).toEqual([])
  })

  test('renders the same rule set, hoisting theme and at-rule blocks into one program order', async () => {
    const [perModule, wholeProgram] = await Promise.all([
      buildFixture('program'),
      buildFixture('program', {compilation: 'whole-program'}),
    ])
    const perModuleCss = findAsset(perModule.output, 'bundle.css')
    const wholeProgramCss = findAsset(wholeProgram.output, 'bundle.css')

    // Same rules...
    expect(topLevelRules(wholeProgramCss).toSorted()).toEqual(
      topLevelRules(perModuleCss).toSorted(),
    )
    // ...and the shared theme module is rendered once, first
    expect(wholeProgramCss.match(/rgb\(10, 20, 30\)/g)).toHaveLength(1)
    expect(topLevelRules(wholeProgramCss)[0]).toContain('rgb(10, 20, 30)')

    // Per module, the `@media` rule of `panel` renders before the later module's base rule;
    // whole-program renders every conditional block after every unconditional rule
    const media = '@media (min-width: 600px)'
    expect(perModuleCss.indexOf(media)).toBeLessThan(perModuleCss.indexOf('rgb(4, 5, 6)'))
    expect(wholeProgramCss.indexOf(media)).toBeGreaterThan(wholeProgramCss.indexOf('rgb(4, 5, 6)'))
    expect(wholeProgram.logs).toEqual([])
  })

  test('routes the program CSS through one virtual module and `inject`', async () => {
    const {output} = await buildFixture('program', {compilation: 'whole-program', inject: true})
    const entry = findEntryChunk(output)

    expect(entry.code.startsWith('import "./bundle.css";\n')).toBe(true)
    expect(entry.moduleIds.filter((id) => id.includes('.vanilla.js'))).toEqual([
      '\0vanilla-extract-program.vanilla.js',
    ])
    // Nothing from the program leaks into the JS
    expect(entry.code).not.toContain('rgb(1, 2, 3)')
    expect(entry.code).not.toContain('virtual:vanilla-extract-program')
  })

  test('emits the CSS once even when modules are split across chunks', async () => {
    const {output} = await buildFixture('dynamic', {compilation: 'whole-program'})
    const css = findAsset(output, 'bundle.css')

    expect(output.filter((assetOrChunk) => assetOrChunk.type === 'chunk').length).toBeGreaterThan(1)
    expect(css.match(/rgb\(1, 2, 3\)/g)).toHaveLength(1)
    expect(css.match(/rgb\(7, 8, 9\)/g)).toHaveLength(1)
  })

  test('falls back to per-module compilation for modules outside `roots`, with a warning', async () => {
    const {output, logs} = await buildFixture('program', {
      compilation: 'whole-program',
      roots: ['test/fixtures/no-css'],
    })
    const css = findAsset(output, 'bundle.css')

    // Every module still compiles and its CSS is still extracted...
    expect(css).toContain('rgb(1, 2, 3)')
    expect(css).toContain('rgb(4, 5, 6)')
    expect(css).toContain('rgb(10, 20, 30)')
    // ...but each one reported that it is outside the program (transforms run concurrently,
    // so the order of the warnings is not contractual)
    expect(
      logs.filter((message) => message.includes('outside the whole-program `roots`')).toSorted(),
    ).toEqual([
      expect.stringContaining('layout.css.ts'),
      expect.stringContaining('overrides.css.ts'),
    ])
  })

  test('reports discovered modules the build never imports', async () => {
    const {output, logs} = await buildFixture('program', {
      compilation: 'whole-program',
      roots: ['test/fixtures/program', 'test/fixtures/basic'],
    })

    // Their CSS is part of the program stylesheet regardless...
    expect(findAsset(output, 'bundle.css')).toContain('inset: 0')
    // ...which is why they are called out
    const warning = logs.find((message) => message.includes('are not imported by this build'))
    expect(warning).toContain('button.css.ts')
    expect(warning).toContain('styles.css.ts')
    expect(warning).not.toContain('layout.css.ts')
  })

  test('works for cjs output too', async () => {
    const {output} = await buildFixture(
      'program',
      {compilation: 'whole-program', inject: true},
      'cjs',
    )

    expect(findEntryChunk(output).code.startsWith('require("./bundle.css");\n')).toBe(true)
    expect(findAsset(output, 'bundle.css')).toContain('rgb(4, 5, 6)')
  })
})

describe('whole-program discovery helpers', () => {
  test('inputEntryFiles handles array and record inputs and skips virtual ids', () => {
    expect(inputEntryFiles(['src/index.ts', '\0virtual', 'virtual:entry'], '/pkg')).toEqual([
      path.resolve('/pkg', 'src/index.ts'),
    ])
    expect(inputEntryFiles({main: '/pkg/src/index.ts', cli: 'src/cli.ts'}, '/pkg')).toEqual([
      '/pkg/src/index.ts',
      path.resolve('/pkg', 'src/cli.ts'),
    ])
  })

  test('defaultProgramRoots collapses nested entry directories', () => {
    expect(
      defaultProgramRoots(['/pkg/src/index.ts', '/pkg/src/cli/index.ts', '/pkg/other/entry.ts']),
    ).toEqual(['/pkg/other', '/pkg/src'])
  })

  test('discoverCssModules finds every .css.* module under the roots, skipping node_modules', async () => {
    const modules = await discoverCssModules([fixturesDir])
    expect(modules.map((file) => path.relative(fixturesDir, file))).toEqual([
      'basic/button.css.ts',
      'basic/styles.css.ts',
      'dynamic/lazy.css.ts',
      'dynamic/static.css.ts',
      'program/layout.css.ts',
      'program/overrides.css.ts',
      'program/theme.css.ts',
    ])
    await expect(discoverCssModules([path.join(fixturesDir, 'does-not-exist')])).resolves.toEqual(
      [],
    )
  })
})
