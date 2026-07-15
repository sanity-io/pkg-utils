import {chromium, type Browser} from 'playwright'
import {afterAll, beforeAll, bench, describe} from 'vitest'
import type {VitePluginKind} from './helpers/commands.ts'
import {
  prepareHmrUpdate,
  primeHmrCase,
  runPreparedHmrUpdate,
  startHmrCase,
  stopHmrCase,
  type HmrCase,
  type HmrScenario,
} from './helpers/hmr.ts'
import {fixedBenchmarkOptions} from './helpers/options.ts'
import {loadFixtureManifest} from './helpers/paths.ts'

const manifest = await loadFixtureManifest()
const testCases: Partial<Record<VitePluginKind, HmrCase>> = {}
let browser: Browser | undefined

function getTestCase(plugin: VitePluginKind): HmrCase {
  const testCase = testCases[plugin]
  if (!testCase) throw new Error(`HMR case for ${plugin} has not started`)
  return testCase
}

beforeAll(async () => {
  try {
    browser = await chromium.launch({headless: true})
  } catch (error) {
    throw new Error(
      'Chromium is required for the HMR benchmark. Run `pnpm --filter @benchmarks/vanilla-extract install-browser` first.',
      {cause: error},
    )
  }

  for (const plugin of ['official', 'sanity'] as const) {
    const testCase = await startHmrCase(browser, manifest.hmr[plugin], plugin)
    testCases[plugin] = testCase
    await primeHmrCase(testCase)
  }
}, 180_000)

afterAll(async () => {
  await Promise.all(Object.values(testCases).map((testCase) => stopHmrCase(testCase)))
  await browser?.close()
}, 120_000)

function registerHmrBenchmark(
  plugin: VitePluginKind,
  scenario: HmrScenario,
  packageName: string,
): void {
  bench(
    packageName,
    () => runPreparedHmrUpdate(getTestCase(plugin)),
    fixedBenchmarkOptions('hmr', {
      setup: () => prepareHmrUpdate(getTestCase(plugin), scenario),
    }),
  )
}

for (const scenario of ['leaf', 'shared'] as const) {
  const title =
    scenario === 'leaf'
      ? 'single .css.ts leaf edit'
      : `shared theme edit (${manifest.hmr.official.styleModules} style importers)`

  describe(title, () => {
    registerHmrBenchmark('official', scenario, 'Vite 8 + @vanilla-extract/vite-plugin')
    registerHmrBenchmark('sanity', scenario, 'Vite 8 + @sanity/vanilla-extract-vite-plugin')
  })
}
