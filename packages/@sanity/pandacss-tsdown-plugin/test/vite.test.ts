import {execFile} from 'node:child_process'
import {cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify, stripVTControlCharacters} from 'node:util'
import {chromium} from 'playwright'
import {rolldown} from 'rolldown'
import {build, createServer, type Plugin, type ServerOptions, type ViteDevServer} from 'vite'
import {describe, expect, onTestFinished, test} from 'vitest'
import {PANDA_STYLESHEET, pandacss, type Options} from '../src/vite.ts'
import {cascadeWinner, ruleLines} from './cascade.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/vite')

const RENAMED_LAYERS = {
  reset: 'app-reset',
  base: 'app-base',
  tokens: 'app-tokens',
  recipes: 'app-recipes',
  utilities: 'app-utilities',
}

/**
 * A throwaway copy of the `vite` fixture under `test/fixtures/vite-<name>.local` (gitignored
 * through `*.local`), with the `cascade-layers` fixture's Panda config extended by `overrides`.
 */
function copyFixture(name: string, overrides: Record<string, unknown>): string {
  const target = path.resolve(__dirname, 'fixtures', `vite-${name}.local`)
  rmSync(target, {recursive: true, force: true})
  mkdirSync(target, {recursive: true})
  for (const file of ['package.json', 'panda.css', 'other.css']) {
    cpSync(path.join(fixtureDir, file), path.join(target, file))
  }
  cpSync(path.join(fixtureDir, 'src'), path.join(target, 'src'), {recursive: true})
  writeFileSync(
    path.join(target, 'panda.config.ts'),
    `import config from '../cascade-layers/panda.config.ts'\n\nexport default {...config, ...${JSON.stringify(overrides)}}\n`,
  )
  onTestFinished(() => rmSync(target, {recursive: true, force: true}))
  return target
}

async function startDevServer(
  plugins: Plugin[],
  root: string = fixtureDir,
  server: ServerOptions = {},
): Promise<ViteDevServer> {
  const devServer = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins,
    server: {middlewareMode: true, ws: false, watch: null, ...server},
  })
  onTestFinished(() => devServer.close())
  return devServer
}

/** A stylesheet as the dev server serves it to a `<link>`: CSS rather than a JS module. */
async function transformCss(server: ViteDevServer, specifier: string): Promise<string> {
  const result = await server.environments.client.transformRequest(`${specifier}?direct`)
  if (!result) expect.unreachable(`expected the dev server to transform ${specifier}`)
  return result.code
}

/** The stylesheet the dev server serves for `virtual:panda.css`. */
async function devStylesheet(options: Options, root: string = fixtureDir): Promise<string> {
  return transformCss(
    await startDevServer(pandacss({cwd: root, ...options}), root),
    PANDA_STYLESHEET,
  )
}

/** The CSS asset of a `vite build` of the fixture's `src/main.ts`. */
async function buildStylesheet(plugins: Plugin[], root: string = fixtureDir): Promise<string> {
  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins,
    build: {write: false, rolldownOptions: {input: path.join(root, 'src/main.ts')}},
  })
  if (Array.isArray(result) || !('output' in result))
    expect.unreachable('expected one build output')
  const assets = result.output.filter(
    (output) => output.type === 'asset' && output.fileName.endsWith('.css'),
  )
  const [asset] = assets
  if (assets.length !== 1 || asset?.type !== 'asset') expect.unreachable('expected one CSS asset')
  return typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source)
}

/** The offsets of rules in a stylesheet, which must each start a line. */
function positionsOf(css: string, rules: readonly string[]): number[] {
  return rules.map((rule) => {
    const index = `\n${css}`.indexOf(`\n${rule}`)
    expect(index, rule).not.toBe(-1)
    return index
  })
}

const hovered = {'data-hover': ''}

describe('`@sanity/pandacss-tsdown-plugin/vite`', () => {
  test('is a `./vite` export that only Vite users install the peers of', async () => {
    const manifest: unknown = JSON.parse(
      readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
    )
    expect(manifest).toMatchObject({
      exports: {'./vite': './src/vite.ts'},
      publishConfig: {exports: {'./vite': './dist/vite.mjs'}},
      peerDependencies: {'vite': '*', '@pandacss/vite': expect.any(String)},
      peerDependenciesMeta: {'vite': {optional: true}, '@pandacss/vite': {optional: true}},
    })

    // Neither tsdown nor the tsdown plugin is loaded, and `vite` only provides types
    const bundle = await rolldown({
      input: path.resolve(__dirname, '../src/vite.ts'),
      external: (id) => !id.startsWith('.') && !path.isAbsolute(id),
      logLevel: 'silent',
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      expect(output[0].imports.toSorted()).toEqual([
        '@pandacss/compiler',
        '@pandacss/vite',
        'lightningcss',
        'postcss',
      ])
    } finally {
      await bundle.close()
    }
  })

  test('wraps `@pandacss/vite`, with a plugin that runs ahead of it', () => {
    expect(pandacss({transform: true}).map((plugin) => plugin.name)).toEqual([
      'sanity:pandacss',
      'pandacss',
    ])
  })
})

describe('`virtual:panda.css`', () => {
  test("declares the Panda config's layers, which makes `@pandacss/vite` generate its CSS into it", async () => {
    const css = await devStylesheet({transform: true})
    expect(css.startsWith('@layer reset, base, tokens, recipes, utilities;\n')).toBe(true)
    for (const layer of ['reset', 'base', 'tokens', 'recipes', 'recipes.slots', 'utilities']) {
      expect(css).toContain(`@layer ${layer} {`)
    }
    expect(css).toContain('.button--tone_brand {')
  })

  test('declares the layers of a config that renames them', async () => {
    const root = copyFixture('renamed-layers', {layers: RENAMED_LAYERS})
    const css = await devStylesheet({transform: true}, root)
    expect(
      css.startsWith('@layer app-reset, app-base, app-tokens, app-recipes, app-utilities;\n'),
    ).toBe(true)
    expect(css).toContain('@layer app-utilities {')
    expect(css).toContain('.button--tone_brand {')
  })

  test('is served under the URL the import in a module is rewritten to', async () => {
    const server = await startDevServer(pandacss({transform: true, cascadeLayers: false}))
    const entry = await server.environments.client.transformRequest('/src/main.ts')
    const url = /import "(\/@id\/[^"]+)"/.exec(entry?.code ?? '')?.[1]
    expect(url).toBe('/@id/__x00__virtual:panda.css')

    // Over HTTP, like a browser requests it: a module that injects the stylesheet
    await server.close()
    const listening = await startDevServer(
      pandacss({transform: true, cascadeLayers: false}),
      fixtureDir,
      {middlewareMode: false, port: 0},
    )
    await listening.listen()
    const [origin] = listening.resolvedUrls?.local ?? []
    if (!origin) expect.unreachable('expected the dev server to listen')
    const module = await (await fetch(new URL(url ?? '', origin))).text()
    expect(module).toContain('__vite__updateStyle')
    expect(module).toContain('.button--tone_brand {')
    expect(module).not.toContain('@layer')
  })
})

describe('`cascadeLayers: false`', () => {
  test('removes every `@layer` block and statement, and keeps every rule as Panda wrote it', async () => {
    const layered = await devStylesheet({transform: true})
    const unlayered = await devStylesheet({transform: true, cascadeLayers: false})
    expect(unlayered).not.toContain('@layer')
    expect(ruleLines(unlayered)).toEqual(ruleLines(layered))
  })

  test("orders the rules like the layers did, sublayers before their layer's own rules", async () => {
    const css = await devStylesheet({transform: true, cascadeLayers: false})
    const positions = positionsOf(css, [
      // reset
      'html, :host {',
      '@supports',
      // base
      'button {',
      // tokens
      ':where(:root, :host) {',
      '@keyframes spin {',
      // recipes: the `base`, `slots`, `variants` and `compound_variants` sublayers, in the order
      // Panda declares them
      '.button {',
      '.card__root {',
      '.card__root--tone_brand {',
      '.button--size_lg {',
      '.button--compound__size_lg__tone_brand {',
      // utilities: `compositions`, which Panda emits last, comes before the utilities it loses to
      '.textStyle_body {',
      '.color_ink {',
      '@media (width >= 48rem) {',
    ])
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
  })

  test("lets an app's own CSS override the base styles, but not the states", async () => {
    const layered = await devStylesheet({transform: true})
    const unlayered = await devStylesheet({transform: true, cascadeLayers: false})
    const app = 'button {\n  color: green;\n  font-weight: 400;\n}\n'
    const winner = (css: string, element: Parameters<typeof cascadeWinner>[1], property: string) =>
      cascadeWinner(
        [
          ['panda', css],
          ['app', app],
        ],
        element,
        property,
      )
    const selected = {tag: 'button', classes: ['button'], attributes: {'aria-selected': 'true'}}

    expect(winner(unlayered, {tag: 'button'}, 'font-weight')).toBe('app: button')
    expect(winner(unlayered, selected, 'font-weight')).toBe(
      'panda: .button:is([aria-selected=true], [data-selected])',
    )
    expect(
      winner(unlayered, {tag: 'button', classes: ['button'], attributes: hovered}, 'color'),
    ).toBe('panda: .button:is(:hover, [data-hover])')
    // Unlayered CSS beats every layered rule, the states included
    expect(winner(layered, selected, 'font-weight')).toBe('app: button')
  })

  test('removes the layers in `vite build` too, after `@pandacss/vite`', async () => {
    const css = await buildStylesheet(pandacss({transform: true, cascadeLayers: false}))
    // Minified by Vite after the layers are gone; the layers of another stylesheet stay
    expect(css).toContain('.button--tone_brand{')
    expect(css.match(/@layer[^{;]*/g)).toEqual(['@layer other'])
    const positions = positionsOf(css.replaceAll('}', '}\n'), [
      'button{font-weight:600}',
      '.button{',
      '.button--tone_brand{',
      '.textStyle_body{',
      '.color_ink{',
    ])
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
  })

  test('rewrites a hand-written stylesheet that declares the layers, but no other', async () => {
    const server = await startDevServer(pandacss({transform: true, cascadeLayers: false}))
    const handWritten = await transformCss(server, '/panda.css')
    expect(handWritten).toContain('.button--tone_brand {')
    expect(handWritten).not.toContain('@layer')
    expect(await transformCss(server, '/other.css')).toContain('@layer other {')
  })

  test('removes the renamed layers of a config', async () => {
    const root = copyFixture('renamed-layers-unlayered', {layers: RENAMED_LAYERS})
    const css = await devStylesheet({transform: true, cascadeLayers: false}, root)
    expect(css).toContain('.button--tone_brand {')
    expect(css).not.toContain('@layer')
  })

  test("can't be combined with the Panda config's `polyfill`", async () => {
    const root = copyFixture('polyfill', {polyfill: true})
    await expect(startDevServer(pandacss({cascadeLayers: false}), root)).rejects.toThrow(
      "`cascadeLayers: false` can't be combined with `polyfill: true`",
    )
  })
})

describe('`banner`', () => {
  test('is prepended to the stylesheet, with or without layers', async () => {
    const unlayered = await devStylesheet({cascadeLayers: false, banner: '@layer sui;'})
    expect(unlayered.startsWith('@layer sui;\nhtml, :host {')).toBe(true)
    expect(unlayered.match(/@layer[^{;]*/g)).toEqual(['@layer sui'])

    const layered = await devStylesheet({banner: '@layer sui;'})
    expect(
      layered.startsWith('@layer sui;\n@layer reset, base, tokens, recipes, utilities;\n'),
    ).toBe(true)
  })

  test('is prepended once to the stylesheet of a build', async () => {
    const css = await buildStylesheet(pandacss({cascadeLayers: false, banner: '@layer sui;'}))
    expect(css.startsWith('@layer sui;')).toBe(true)
    expect(css.match(/@layer[^{;]*/g)).toEqual(['@layer sui', '@layer other'])
  })
})

describe('several Panda projects', () => {
  test('generate their CSS into one stylesheet, rewritten once', async () => {
    // A second project whose layers have other names, and whose class names have a prefix
    const other = copyFixture('second-project', {layers: RENAMED_LAYERS, prefix: 'second'})
    const options = {cascadeLayers: false, banner: '@layer sui;'}
    const server = await startDevServer([
      ...pandacss({cwd: fixtureDir, ...options}),
      ...pandacss({cwd: other, ...options}),
    ])
    const css = await transformCss(server, PANDA_STYLESHEET)
    expect(css.match(/@layer[^{;]*/g)).toEqual(['@layer sui'])
    // Every layer of the first project, then every layer of the second, as the stylesheet
    // declared them
    const positions = positionsOf(css, [
      'html, :host {',
      '.button--tone_brand {',
      '.color_ink {',
      '.second-button--tone_brand {',
      '.second-color_ink {',
    ])
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
  })

  test('must agree on the options that apply to the stylesheet', async () => {
    const other = copyFixture('disagreeing-project', {prefix: 'second'})
    await expect(
      startDevServer([
        ...pandacss({cwd: fixtureDir, cascadeLayers: false}),
        ...pandacss({cwd: other}),
      ]),
    ).rejects.toThrow('must have the same `cascadeLayers` and `banner` options')
  })
})

describe('the dev server', () => {
  test('declares the layers of a config edited while it runs', {timeout: 30_000}, async () => {
    const root = copyFixture('edited-config', {})
    const server = await startDevServer(pandacss({transform: true}), root, {
      watch: {usePolling: true, interval: 50},
    })
    expect(await transformCss(server, PANDA_STYLESHEET)).toContain(
      '@layer reset, base, tokens, recipes, utilities;',
    )

    writeFileSync(
      path.join(root, 'panda.config.ts'),
      `import config from '../cascade-layers/panda.config.ts'\n\nexport default {...config, layers: ${JSON.stringify(RENAMED_LAYERS)}}\n`,
    )
    await expect
      .poll(() => transformCss(server, PANDA_STYLESHEET), {timeout: 20_000, interval: 100})
      .toContain('@layer app-utilities {')
  })
})

/** Whether the Chromium that `playwright install chromium` downloads is there to run tests in. */
const hasChromium = existsSync(chromium.executablePath())

describe("Vitest's browser mode", () => {
  test.skipIf(!hasChromium && !process.env['CI'])(
    'renders the stylesheet without layers in Chromium',
    {timeout: 120_000},
    async () => {
      // `test/fixtures/vite/vitest.config.ts`, in a Vitest of its own
      const require = createRequire(import.meta.url)
      const vitestBin = path.join(
        path.dirname(require.resolve('vitest/package.json')),
        'vitest.mjs',
      )
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.startsWith('VITEST')),
      )
      const {stdout} = await promisify(execFile)(
        process.execPath,
        [vitestBin, 'run', '--root', fixtureDir],
        {env, timeout: 110_000},
      )
      // Colored when CI forces colors
      expect(stripVTControlCharacters(stdout)).toMatch(/Tests\s+2 passed \(2\)/)
    },
  )
})
