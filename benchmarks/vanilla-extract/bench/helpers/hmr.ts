import assert from 'node:assert/strict'
import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'
import type {Browser, BrowserContext, Page} from 'playwright'
import {createServer, type ViteDevServer} from 'vite'
import type {VitePluginKind} from './commands.ts'
import {fixturePath, type FixtureDescription} from './paths.ts'
import {createVitePlugins} from './plugins.ts'

export type HmrScenario = 'leaf' | 'shared'

const colors = {
  leaf: ['rgb(10, 20, 30)', 'rgb(30, 20, 10)'],
  shared: ['rgb(1, 2, 3)', 'rgb(3, 2, 1)'],
} as const

interface BrowserRuntime {
  loads: number
  ready: boolean
  updates: number
}

export interface HmrCase {
  context: BrowserContext
  currentIndex: Record<HmrScenario, 0 | 1>
  currentSource: Record<HmrScenario, string>
  fixture: FixtureDescription
  lastUpdates: number
  page: Page
  plugin: VitePluginKind
  server: ViteDevServer
}

function readBrowserRuntime(page: Page): Promise<BrowserRuntime | undefined> {
  return page.evaluate(() => {
    const benchmarkWindow = window as typeof window & {
      __vanillaExtractBenchmark?: BrowserRuntime
    }
    const runtime = benchmarkWindow.__vanillaExtractBenchmark
    return runtime ? {...runtime} : undefined
  })
}

function scenarioFilePath(testCase: HmrCase, scenario: HmrScenario): string {
  const sourceRoot = path.join(fixturePath(testCase.fixture), 'src')
  return scenario === 'leaf'
    ? path.join(sourceRoot, 'styles/style-00000.css.ts')
    : path.join(sourceRoot, 'theme.ts')
}

export async function startHmrCase(
  browser: Browser,
  fixture: FixtureDescription,
  plugin: VitePluginKind,
): Promise<HmrCase> {
  const root = fixturePath(fixture)
  const server = await createServer({
    root,
    appType: 'spa',
    cacheDir: path.join(root, `.vite-hmr-${plugin}`),
    clearScreen: false,
    configFile: false,
    logLevel: 'silent',
    plugins: createVitePlugins(plugin),
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
    },
  })

  let context: BrowserContext | undefined
  try {
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') {
      throw new Error(`Could not determine the Vite dev server port for ${plugin}`)
    }

    context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${address.port}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    await page.waitForFunction(
      () => {
        const benchmarkWindow = window as typeof window & {
          __vanillaExtractBenchmark?: BrowserRuntime
        }
        return benchmarkWindow.__vanillaExtractBenchmark?.ready === true
      },
      undefined,
      {timeout: 60_000},
    )

    const runtime = await readBrowserRuntime(page)
    assert(runtime, `${plugin} browser runtime did not initialize`)
    assert.equal(runtime.loads, 1, `${plugin} should load the page exactly once`)
    const sourceRoot = path.join(root, 'src')
    const currentSource = {
      leaf: await readFile(path.join(sourceRoot, 'styles/style-00000.css.ts'), 'utf8'),
      shared: await readFile(path.join(sourceRoot, 'theme.ts'), 'utf8'),
    }

    return {
      context,
      currentIndex: {leaf: 0, shared: 0},
      currentSource,
      fixture,
      lastUpdates: runtime.updates,
      page,
      plugin,
      server,
    }
  } catch (error) {
    await context?.close()
    await server.close()
    throw error
  }
}

export async function runHmrUpdate(testCase: HmrCase, scenario: HmrScenario): Promise<void> {
  const currentIndex = testCase.currentIndex[scenario]
  const nextIndex = currentIndex === 0 ? 1 : 0
  const filePath = scenarioFilePath(testCase, scenario)
  const source = testCase.currentSource[scenario]
  const currentColor = colors[scenario][currentIndex]
  const expectedColor = colors[scenario][nextIndex]
  assert(
    source.includes(currentColor),
    `Expected ${filePath} to contain the current ${scenario} color ${currentColor}`,
  )

  const contents = source.replace(currentColor, expectedColor)
  const previousUpdates = testCase.lastUpdates
  testCase.currentIndex[scenario] = nextIndex
  testCase.currentSource[scenario] = contents
  await writeFile(filePath, contents)

  try {
    const completion = await testCase.page.waitForFunction(
      (update) => {
        const benchmarkWindow = window as typeof window & {
          __vanillaExtractBenchmark?: BrowserRuntime
        }
        const runtime = benchmarkWindow.__vanillaExtractBenchmark
        const probe = document.querySelector('#probe')
        if (!runtime || !(probe instanceof HTMLElement)) return false

        const style = getComputedStyle(probe)
        const actualColor = update.scenario === 'leaf' ? style.backgroundColor : style.color
        return runtime.loads === 1 &&
          runtime.updates > update.previousUpdates &&
          actualColor === update.expectedColor
          ? runtime.updates
          : false
      },
      {
        expectedColor,
        previousUpdates,
        scenario,
      },
      {
        polling: 10,
        timeout: Number.parseInt(process.env['VE_BENCH_HMR_TIMEOUT'] ?? '30000', 10),
      },
    )
    const updates = await completion.jsonValue()
    await completion.dispose()
    if (typeof updates !== 'number') {
      throw new Error(`Expected an HMR update count for ${testCase.plugin}`)
    }
    testCase.lastUpdates = updates
  } catch (error) {
    const runtime = await readBrowserRuntime(testCase.page).catch(() => undefined)
    const actualColor = await testCase.page
      .locator('#probe')
      .evaluate((probe, requestedScenario) => {
        const style = getComputedStyle(probe)
        return requestedScenario === 'leaf' ? style.backgroundColor : style.color
      }, scenario)
      .catch(() => 'unavailable')
    throw new Error(
      `${testCase.plugin} ${scenario} HMR did not settle: expected ${expectedColor}, received ${actualColor}, runtime=${JSON.stringify(runtime)}`,
      {cause: error},
    )
  }
}

export async function primeHmrCase(testCase: HmrCase): Promise<void> {
  for (const scenario of ['leaf', 'shared'] as const) {
    await runHmrUpdate(testCase, scenario)
  }
}

export async function stopHmrCase(testCase: HmrCase): Promise<void> {
  await testCase.context.close()
  await testCase.server.close()
}
