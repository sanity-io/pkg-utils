import {execFile} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify, stripVTControlCharacters} from 'node:util'
import {pandacss} from '@pandacss/vite'
import {chromium} from 'playwright'
import type {AcceptedPlugin} from 'postcss'
import {rolldown} from 'rolldown'
import {build, createServer, type InlineConfig, type Plugin} from 'vite'
import {describe, expect, onTestFinished, test} from 'vitest'
import {removeCascadeLayers} from '../src/vite.ts'
import {ruleLines} from './cascade.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/vite')

const PANDA_LAYERS = ['reset', 'base', 'tokens', 'recipes', 'utilities']

function viteConfig(plugins: Plugin[], config: InlineConfig = {}): InlineConfig {
  return {root: fixtureDir, configFile: false, logLevel: 'silent', plugins, ...config}
}

/** A dev server of the fixture, serving its stylesheets the way it serves them to a `<link>`. */
async function startDevServer(
  plugins: Plugin[],
  config: InlineConfig = {},
): Promise<(file: string) => Promise<string>> {
  const server = await createServer(
    viteConfig(plugins, {server: {middlewareMode: true, ws: false, watch: null}, ...config}),
  )
  onTestFinished(() => server.close())
  return async (file) => {
    const result = await server.environments.client.transformRequest(`${file}?direct`)
    if (!result) expect.unreachable(`expected the dev server to transform ${file}`)
    return result.code
  }
}

/** The CSS asset of a `vite build` of the fixture's `src/main.ts`. */
async function buildStylesheet(plugins: Plugin[]): Promise<string> {
  const result = await build(
    viteConfig(plugins, {
      build: {write: false, rolldownOptions: {input: path.join(fixtureDir, 'src/main.ts')}},
    }),
  )
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

/** Whether the Chromium that `playwright install chromium` downloads is there to run tests in. */
const hasChromium = existsSync(chromium.executablePath())

describe('`removeCascadeLayers`', () => {
  test('is the `./vite` export, whose peers only it needs', async () => {
    const manifest: unknown = JSON.parse(
      readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'),
    )
    expect(manifest).toMatchObject({
      exports: {'./vite': './src/vite.ts'},
      publishConfig: {exports: {'./vite': './dist/vite.mjs'}},
      peerDependencies: {vite: '*'},
      peerDependenciesMeta: {vite: {optional: true}},
    })

    // Neither tsdown nor the tsdown plugin is loaded, and `vite` only provides types
    const bundle = await rolldown({
      input: path.resolve(__dirname, '../src/vite.ts'),
      external: (id) => !id.startsWith('.') && !path.isAbsolute(id),
      logLevel: 'silent',
    })
    try {
      const {output} = await bundle.generate({format: 'esm'})
      expect(output[0].imports.toSorted()).toEqual(['lightningcss', 'postcss'])
    } finally {
      await bundle.close()
    }
  })

  test('removes the layers of the CSS `@pandacss/vite` generates in `vite dev`', async () => {
    const layered = await (await startDevServer([pandacss({transform: true})]))('/panda.css')
    const panda = await (
      await startDevServer([pandacss({transform: true}), removeCascadeLayers(PANDA_LAYERS)])
    )('/panda.css')
    expect(layered).toContain('@layer utilities {')
    expect(panda).not.toContain('@layer')
    // The same rules, ordered like the layers did, sublayers before their layer's own rules
    expect(ruleLines(panda)).toEqual(ruleLines(layered))
    const positions = positionsOf(panda, [
      'html, :host {',
      'button {',
      ':where(:root, :host) {',
      '.button {',
      '.card__root {',
      '.button--tone_brand {',
      '.textStyle_body {',
      '.color_ink {',
      '@media (width >= 48rem) {',
    ])
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
  })

  test("runs after `@pandacss/vite` wherever it is registered, and before Vite's CSS pipeline", async () => {
    // The CSS Vite's PostCSS step receives, by file
    const received = new Map<string, string>()
    const observer: AcceptedPlugin = {
      postcssPlugin: 'observer',
      Once(root, {result}) {
        received.set(path.basename(result.opts.from ?? ''), root.toString())
      },
    }
    const panda = await (
      await startDevServer([removeCascadeLayers(PANDA_LAYERS), pandacss({transform: true})], {
        css: {postcss: {plugins: [observer]}},
      })
    )('/panda.css')
    expect(panda).toContain('.button--tone_brand {')
    expect(panda).not.toContain('@layer')
    expect(received.get('panda.css')).toContain('.button--tone_brand {')
    expect(received.get('panda.css')).not.toContain('@layer')
  })

  test('keeps the layers it is not given, here and in other stylesheets', async () => {
    const transform = await startDevServer([
      pandacss({transform: true}),
      removeCascadeLayers(['reset', 'base', 'tokens', 'recipes']),
    ])
    const panda = await transform('/panda.css')
    const other = await transform('/other.css')
    expect(panda).toMatch(/^@layer utilities;$/m)
    expect(panda).toContain('@layer utilities {')
    expect(panda).not.toMatch(/@layer (?:reset|base|tokens|recipes)\b/)
    expect(panda).toContain('.button--tone_brand {')
    expect(other).toContain('@layer other {')
  })

  test('recognizes `@layer` in any case, since authored CSS reaches it as written', async () => {
    const css = await (await startDevServer([removeCascadeLayers(['base'])]))('/uppercase.css')
    expect(css).not.toContain('@LAYER')
    expect(css).toMatch(/^\.base \{$/m)
  })

  test('takes top-level layer names, which remove their sublayers too', async () => {
    // A sublayer can't be removed on its own: its order depends on the layers it is declared next
    // to, such as `other` in `@layer panda, other;`
    expect(() => removeCascadeLayers(['panda.base', 'other'])).toThrow(
      '`removeCascadeLayers()` takes top-level layer names, not the sublayer `panda.base`',
    )

    const css = await (await startDevServer([removeCascadeLayers(['panda'])]))('/dotted.css')
    expect(css).not.toContain('@layer panda')
    expect(css).toContain('@layer base {')
    // In the order the statement declares them, and the nested block's sublayer too
    const positions = positionsOf(css, ['.panda-reset {', '.panda-base {', '.nested-base {'])
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
  })

  test('removes the layers in `vite build` too', async () => {
    const css = await buildStylesheet([
      pandacss({transform: true}),
      removeCascadeLayers(PANDA_LAYERS),
    ])
    // Minified by Vite after the layers are gone; the layers of the other stylesheet stay
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

  test.skipIf(!hasChromium && !process.env['CI'])(
    "renders the CSS without layers in Vitest's browser mode",
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
