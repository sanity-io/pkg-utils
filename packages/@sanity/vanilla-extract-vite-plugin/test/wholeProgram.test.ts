import {mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {normalizePath} from '@sanity/vanilla-extract-integration'
import {build, createServer, type Rollup} from 'vite'
import {afterEach, describe, expect, test} from 'vitest'
import {createCompiler, PROGRAM_CSS_ID, vanillaExtractPlugin, type Compiler} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, 'fixtures/app')
const programRoot = path.resolve(__dirname, 'fixtures/mutable-program')

const stylesCssTs = path.join(appRoot, 'src/styles.css.ts')
const buttonCssTs = path.join(appRoot, 'src/button.css.ts')

const layoutCssTs = path.join(programRoot, 'src/layout.css.ts')
const overridesCssTs = path.join(programRoot, 'src/overrides.css.ts')
const themeTs = path.join(programRoot, 'src/theme.ts')

/**
 * (Re-)generates the gitignored mutable program fixture: a shared plain theme module, a
 * `.css.ts` with a media-query rule and a `.css.ts` with a plain rule imported after it.
 */
async function writeProgramFixture({
  accent = 'rgb(1, 2, 3)',
  shownDisplay = 'block',
}: {accent?: string; shownDisplay?: string} = {}): Promise<void> {
  await rm(path.join(programRoot, 'src'), {recursive: true, force: true})
  await mkdir(path.join(programRoot, 'src'), {recursive: true})
  await writeFile(
    path.join(programRoot, 'package.json'),
    `${JSON.stringify({name: '@fixtures/mutable-program', private: true, type: 'module'}, null, 2)}\n`,
  )
  await writeFile(themeTs, [`export const accentColor: string = '${accent}'`, ``].join('\n'))
  await writeFile(
    layoutCssTs,
    [
      `import {style} from '@vanilla-extract/css'`,
      `import {accentColor} from './theme.ts'`,
      ``,
      `export const panel: string = style({`,
      `  color: accentColor,`,
      `  '@media': {`,
      `    '(min-width: 600px)': {`,
      `      display: 'none',`,
      `    },`,
      `  },`,
      `})`,
      ``,
    ].join('\n'),
  )
  await writeFile(
    overridesCssTs,
    [
      `import {style} from '@vanilla-extract/css'`,
      ``,
      `export const shown: string = style({`,
      `  display: '${shownDisplay}',`,
      `  borderColor: 'rgb(4, 5, 6)',`,
      `})`,
      ``,
    ].join('\n'),
  )
  await writeFile(
    path.join(programRoot, 'src/main.ts'),
    [
      `import {panel} from './layout.css.ts'`,
      `import {shown} from './overrides.css.ts'`,
      ``,
      `document.body.className = \`\${panel} \${shown}\``,
      ``,
    ].join('\n'),
  )
}

/** The program CSS import as Vite's import analysis rewrites it in dev (`/@id/` prefixed). */
const programImportPattern =
  /import\s+["']((?:\/@id\/)?virtual:vanilla-extract-program\.vanilla\.css[^"']*)["']/

/**
 * The url to request the program CSS module at: what a `.css.ts` module imports, minus the
 * `/@id/` prefix Vite's transform middleware strips before `transformRequest`.
 */
function programCssUrl(code: string | undefined): string {
  const match = code?.match(programImportPattern)
  if (!match?.[1]) expect.unreachable('expected the program CSS import')
  return match[1].replace(/^\/@id\//, '')
}

/** The serialized exports of a module, without its CSS import lines. */
const exportsOf = (source: string) =>
  source
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n')

/** Vite's (internal) invalidation state of a module: `'HARD_INVALIDATED'` or a soft state. */
const invalidationStateOf = (mod: {id: string | null} | undefined): unknown =>
  (mod as {invalidationState?: unknown} | undefined)?.invalidationState

const compilersToClose: Compiler[] = []
afterEach(async () => {
  await Promise.all(compilersToClose.splice(0).map((compiler) => compiler.close()))
})

function createProgramCompiler(root: string, enableFileWatcher = false): Compiler {
  const compiler = createCompiler({
    root,
    identifiers: 'debug',
    enableFileWatcher,
    compilation: 'whole-program',
  })
  compilersToClose.push(compiler)
  return compiler
}

async function createProgramServer(root: string) {
  return createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: {middlewareMode: true},
    appType: 'custom',
    plugins: [vanillaExtractPlugin({compilation: 'whole-program'})],
  })
}

describe('compiler: whole-program', () => {
  test('serves every member from one program, importing one CSS module', async () => {
    const perModule = createCompiler({
      root: appRoot,
      identifiers: 'debug',
      enableFileWatcher: false,
    })
    compilersToClose.push(perModule)
    const program = createProgramCompiler(appRoot)

    const [perModuleStyles, programStyles] = await Promise.all([
      perModule.processVanillaFile(stylesCssTs),
      program.processVanillaFile(stylesCssTs),
    ])

    // Same exports as per-module compilation, only the CSS import differs
    expect(exportsOf(programStyles.source)).toBe(exportsOf(perModuleStyles.source))
    expect(programStyles.source.startsWith(`import '${PROGRAM_CSS_ID}';\n`)).toBe(true)
    expect(programStyles.watchFiles).toContain(normalizePath(path.join(appRoot, 'src/theme.ts')))

    // Discovery found button.css.ts too, so the program CSS already has both modules
    const {css, modules} = await program.processVanillaProgram()
    expect([...modules.keys()]).toEqual([normalizePath(buttonCssTs), normalizePath(stylesCssTs)])
    expect(css).toContain('rgb(4, 5, 6)')
    expect(css).toContain('rgb(1, 2, 3)')
    expect(program.getCssForFile(PROGRAM_CSS_ID)?.css).toBe(css)
    expect(program.getCssForFile(stylesCssTs)).toBeUndefined()
    expect(program.getAllCss()).toBe(`${css}\n`)

    // An unchanged program is not rebuilt
    expect(await program.processVanillaProgram()).toBe(await program.processVanillaProgram())
  })

  test('renders conditional blocks after every unconditional rule, in dependency-then-discovery order', async () => {
    await writeProgramFixture()
    const compiler = createProgramCompiler(programRoot)

    const {css} = await compiler.processVanillaProgram()
    const media = '@media (min-width: 600px)'
    expect(css).toContain(media)
    // Per-module rendering would put layout's media block before overrides' base rule
    expect(css.indexOf(media)).toBeGreaterThan(css.indexOf('rgb(4, 5, 6)'))
    expect(css.indexOf('rgb(1, 2, 3)')).toBeLessThan(css.indexOf('rgb(4, 5, 6)'))
  })

  test('rebuilds on invalidation and reports exactly the changed members', async () => {
    await writeProgramFixture()
    const compiler = createProgramCompiler(programRoot)

    const first = await compiler.processVanillaProgram()
    expect([...first.changedModules].toSorted((a, b) => a.localeCompare(b))).toEqual(
      [normalizePath(layoutCssTs), normalizePath(overridesCssTs)].toSorted((a, b) =>
        a.localeCompare(b),
      ),
    )

    // A dependency edit changes the CSS but no member's class names: nothing is reported
    await writeFile(themeTs, [`export const accentColor: string = 'rgb(7, 8, 9)'`, ``].join('\n'))
    await compiler.invalidateFile(themeTs)
    const second = await compiler.processVanillaProgram()
    expect(second.css).toContain('rgb(7, 8, 9)')
    expect(second.css).not.toContain('rgb(1, 2, 3)')
    expect(second.changedModules.size).toBe(0)

    // Adding an export to a member changes that member only
    await writeFile(
      overridesCssTs,
      [
        `import {style} from '@vanilla-extract/css'`,
        ``,
        `export const shown: string = style({display: 'block', borderColor: 'rgb(4, 5, 6)'})`,
        `export const hidden: string = style({display: 'none'})`,
        ``,
      ].join('\n'),
    )
    await compiler.invalidateFile(overridesCssTs)
    const third = await compiler.processVanillaProgram()
    expect([...third.changedModules]).toEqual([normalizePath(overridesCssTs)])
    expect(third.modules.get(normalizePath(overridesCssTs))).toContain('export var hidden')
    expect(third.modules.get(normalizePath(layoutCssTs))).toBe(
      first.modules.get(normalizePath(layoutCssTs)),
    )
  })

  test('adds requested modules that discovery did not cover', async () => {
    await writeProgramFixture()
    const compiler = createCompiler({
      root: programRoot,
      identifiers: 'debug',
      enableFileWatcher: false,
      compilation: 'whole-program',
      roots: [path.join(programRoot, 'does-not-exist')],
    })
    compilersToClose.push(compiler)

    const {source} = await compiler.processVanillaFile(layoutCssTs)
    expect(source).toContain('export var panel')
    const program = await compiler.processVanillaProgram()
    expect([...program.modules.keys()]).toEqual([normalizePath(layoutCssTs)])
    expect(program.css).not.toContain('rgb(4, 5, 6)')

    await compiler.processVanillaFile(overridesCssTs)
    expect((await compiler.processVanillaProgram()).css).toContain('rgb(4, 5, 6)')
  })
})

describe('vite dev: whole-program', () => {
  test('serves `.css.ts` modules importing the single program CSS module', async () => {
    const server = await createProgramServer(appRoot)
    try {
      const transformed = await server.transformRequest('/src/styles.css.ts')
      expect(transformed?.code).toContain('export var box')
      expect(transformed?.code).not.toContain('.css.ts.vanilla.css')

      // Vite's import analysis rewrites the program CSS import to an `/@id/` url, which
      // resolves through Vite's CSS pipeline with both modules' CSS
      expect(transformed?.code).toMatch(programImportPattern)
      const css = await server.transformRequest(programCssUrl(transformed?.code))
      expect(css?.code).toContain('rgb(1, 2, 3)')
      expect(css?.code).toContain('rgb(4, 5, 6)')
    } finally {
      await server.close()
    }
  })

  test('serves the program CSS without a prior member transform', async () => {
    const server = await createProgramServer(appRoot)
    try {
      const css = await server.transformRequest(PROGRAM_CSS_ID)
      expect(css?.code).toContain('rgb(1, 2, 3)')
      expect(css?.code).toContain('rgb(4, 5, 6)')
    } finally {
      await server.close()
    }
  })

  test('`hotUpdate` swaps the program stylesheet and only the changed members', async () => {
    await writeProgramFixture()
    const plugins = vanillaExtractPlugin({compilation: 'whole-program'})
    const server = await createServer({
      root: programRoot,
      configFile: false,
      logLevel: 'silent',
      server: {middlewareMode: true},
      appType: 'custom',
      plugins: [plugins],
    })
    try {
      const layoutTransformed = await server.transformRequest('/src/layout.css.ts')
      await server.transformRequest('/src/overrides.css.ts')
      await server.transformRequest(programCssUrl(layoutTransformed?.code))

      const environment = server.environments.client
      const programCssModules = [
        ...(environment.moduleGraph.getModulesByFile(PROGRAM_CSS_ID) ?? []),
      ]
      const layoutModule = environment.moduleGraph.getModuleById(normalizePath(layoutCssTs))
      const overridesModule = environment.moduleGraph.getModuleById(normalizePath(overridesCssTs))
      const programCssTransformed = () => programCssModules.some((mod) => mod.transformResult)
      expect(programCssModules.length).toBeGreaterThan(0)
      expect(programCssTransformed()).toBe(true)
      expect(layoutModule?.transformResult).toBeTruthy()
      expect(overridesModule?.transformResult).toBeTruthy()

      const plugin = plugins.find((candidate) => candidate.name === 'sanity-vanilla-extract')
      const hotUpdate = plugin?.hotUpdate
      const handler = typeof hotUpdate === 'object' ? hotUpdate.handler : hotUpdate
      if (!handler) expect.unreachable('expected a `hotUpdate` hook')

      // A theme edit: the stylesheet is invalidated, and so is `layout.css.ts` (it depends on
      // the theme, and its exports could too - the same as per-module compilation), while
      // `overrides.css.ts` is only soft-invalidated for importing the stylesheet
      await writeFile(themeTs, [`export const accentColor: string = 'rgb(7, 8, 9)'`, ``].join('\n'))
      await handler.call({environment} as never, {
        type: 'update',
        file: normalizePath(themeTs),
        timestamp: Date.now(),
        modules: [],
        read: () => '',
        server,
      })
      expect(programCssTransformed()).toBe(false)
      expect(invalidationStateOf(layoutModule)).toBe('HARD_INVALIDATED')
      expect(invalidationStateOf(overridesModule)).not.toBe('HARD_INVALIDATED')

      const css = await server.transformRequest(programCssUrl(layoutTransformed?.code))
      expect(css?.code).toContain('rgb(7, 8, 9)')
      expect(css?.code).not.toContain('rgb(1, 2, 3)')
      expect(programCssTransformed()).toBe(true)

      // A new export in overrides.css.ts changes that member's JS: it is hard-invalidated,
      // `layout.css.ts` (re-transformed above) only softly for importing the stylesheet
      await server.transformRequest('/src/layout.css.ts')
      await writeFile(
        overridesCssTs,
        [
          `import {style} from '@vanilla-extract/css'`,
          ``,
          `export const shown: string = style({display: 'block', borderColor: 'rgb(4, 5, 6)'})`,
          `export const hidden: string = style({display: 'none'})`,
          ``,
        ].join('\n'),
      )
      await handler.call({environment} as never, {
        type: 'update',
        file: normalizePath(overridesCssTs),
        timestamp: Date.now(),
        modules: [],
        read: () => '',
        server,
      })
      expect(programCssTransformed()).toBe(false)
      expect(invalidationStateOf(overridesModule)).toBe('HARD_INVALIDATED')
      expect(invalidationStateOf(layoutModule)).not.toBe('HARD_INVALIDATED')
      expect((await server.transformRequest('/src/overrides.css.ts'))?.code).toContain(
        'export var hidden',
      )
    } finally {
      await server.close()
    }
  })

  test('`vite build` keeps compiling per module', {timeout: 30_000}, async () => {
    await writeProgramFixture()
    await writeFile(
      path.join(programRoot, 'index.html'),
      '<!doctype html><html><body><script type="module" src="/src/main.ts"></script></body></html>\n',
    )
    const result = await build({
      root: programRoot,
      configFile: false,
      logLevel: 'silent',
      plugins: [vanillaExtractPlugin({compilation: 'whole-program'})],
      build: {write: false},
    })
    const {output} = Array.isArray(result) ? result[0]! : (result as Rollup.RollupOutput)
    const cssAsset = output.find(
      (assetOrChunk) => assetOrChunk.type === 'asset' && assetOrChunk.fileName.endsWith('.css'),
    )
    if (!cssAsset || cssAsset.type !== 'asset') expect.unreachable('expected a `.css` asset')
    const css = String(cssAsset.source)
    // Both modules' CSS, in Vite's module order: the media block of `layout` before the base
    // rule of `overrides` (the per-module order), not the program order
    expect(css.includes('#040506') || css.includes('rgb(4, 5, 6)')).toBe(true)
    expect(css.indexOf('@media')).toBeLessThan(css.indexOf('#040506'))
  })
})
