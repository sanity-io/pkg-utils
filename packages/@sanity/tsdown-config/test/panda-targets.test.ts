import {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {build, mergeConfig, type UserConfig} from 'tsdown'
import {afterAll, describe, expect, test} from 'vitest'
import {defineConfig, type PackageOptions} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pandaFixtureDir = path.resolve(__dirname, 'fixtures/panda-library')
/** Below the fixture, so the copied `panda.config.ts` resolves its `@pandacss/dev`. */
const scratchDir = path.join(pandaFixtureDir, '.targets.local')

/**
 * A copy of the `panda-library` fixture with one source whose stylesheet tells the targets
 * apart: chrome61 predates `inset`, and the `@sanity/browserslist-config` browsers (Chrome 109,
 * iOS 15.6) predate `oklch()`, while the Baseline Widely available ones support both.
 */
function scratchProject(name: string): string {
  const dir = path.join(scratchDir, name)
  rmSync(dir, {recursive: true, force: true})
  mkdirSync(path.join(dir, 'src'), {recursive: true})
  for (const file of ['panda.config.ts', 'tsconfig.dist.json']) {
    cpSync(path.join(pandaFixtureDir, file), path.join(dir, file))
  }
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: `@fixtures/panda-targets-${name}`,
      private: true,
      type: 'module',
      imports: {'#styled-system/*': './styled-system/*/index.js'},
    }),
  )
  writeFileSync(
    path.join(dir, 'src/index.ts'),
    "import {css} from '#styled-system/css'\n\nexport const box: string = css({color: 'oklch(60% 0.2 30)', inset: 0})\n",
  )
  return dir
}

/** Builds the project with a (composed) config, returning the extracted stylesheet. */
async function buildStylesheet(cwd: string, config: UserConfig): Promise<string> {
  await build({
    ...config,
    config: false,
    cwd,
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false,
    // Nothing to write into the scratch package.json
    exports: false,
    logLevel: 'silent',
    publint: false,
  })
  return readFileSync(path.join(cwd, 'dist/bundle.css'), 'utf-8')
}

function packageOptions(cwd: string, options: PackageOptions): PackageOptions {
  return {cwd, tsconfig: 'tsconfig.dist.json', platform: 'neutral', ...options}
}

afterAll(() => {
  rmSync(scratchDir, {recursive: true, force: true})
})

describe('panda CSS targets', () => {
  test('come from the final config, after a composed `target` override', async () => {
    const cwd = scratchProject('composed')
    // Without a target, the `@sanity/browserslist-config` browsers apply: they keep `inset`
    const fallback = await buildStylesheet(
      cwd,
      await defineConfig(packageOptions(cwd, {panda: true})),
    )
    expect(fallback).toContain('inset: 0')

    // A `target` composed after `defineConfig()` decides instead
    const composed = await buildStylesheet(
      cwd,
      mergeConfig(await defineConfig(packageOptions(cwd, {panda: true})), {target: 'chrome61'}),
    )
    expect(composed).not.toContain('inset:')
    expect(composed).toContain('top: 0')
  })

  test('keep an explicit `panda.target` or `panda.lightningcss.targets` winning', async () => {
    const cwd = scratchProject('explicit')
    const pandaTarget = await buildStylesheet(
      cwd,
      mergeConfig(await defineConfig(packageOptions(cwd, {panda: {target: 'chrome120'}})), {
        target: 'chrome61',
      }),
    )
    expect(pandaTarget).toContain('inset: 0')

    const lightningcssTargets = await buildStylesheet(
      cwd,
      mergeConfig(
        await defineConfig(
          packageOptions(cwd, {panda: {lightningcss: {targets: {chrome: 61 << 16}}}}),
        ),
        {target: 'chrome120'},
      ),
    )
    expect(lightningcssTargets).not.toContain('inset:')
  })

  test("resolve tsdown's `baseline-widely-available` alias to its browsers", async () => {
    // The fallback's browsers would lower `oklch()` to a hex and `lab()` pair
    const cwd = scratchProject('baseline')
    for (const options of [
      {panda: true, target: 'baseline-widely-available'},
      {panda: {target: 'baseline-widely-available'}, target: 'node22'},
    ] satisfies PackageOptions[]) {
      const css = await buildStylesheet(cwd, await defineConfig(packageOptions(cwd, options)))
      expect(css).toContain('oklch(60% .2 30)')
      expect(css).not.toContain('#de3e2d')
    }
  })
})
