import {mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {build, type Plugin} from 'vite'
import type {VitePluginKind} from './commands.ts'
import {fixturePath, resultsRoot, type FixtureDescription} from './paths.ts'
import {createVitePlugins} from './plugins.ts'

const hookNames = ['resolveId', 'load', 'transform'] as const
type HookName = (typeof hookNames)[number]
type HookCounts = Record<HookName, number>

export interface HookDiagnosticResult extends HookCounts {
  plainModules: number
  plugin: VitePluginKind
  styleModules: number
}

function instrumentPlugin(plugin: Plugin, counts: HookCounts): Plugin {
  const resolveId = plugin.resolveId
  if (typeof resolveId === 'function') {
    const wrapped: typeof resolveId = function (...arguments_) {
      counts.resolveId += 1
      return resolveId.apply(this, arguments_)
    }
    plugin.resolveId = wrapped
  } else if (resolveId) {
    const {handler} = resolveId
    const wrapped: typeof handler = function (...arguments_) {
      counts.resolveId += 1
      return handler.apply(this, arguments_)
    }
    plugin.resolveId = {...resolveId, handler: wrapped}
  }

  const load = plugin.load
  if (typeof load === 'function') {
    const wrapped: typeof load = function (...arguments_) {
      counts.load += 1
      return load.apply(this, arguments_)
    }
    plugin.load = wrapped
  } else if (load) {
    const {handler} = load
    const wrapped: typeof handler = function (...arguments_) {
      counts.load += 1
      return handler.apply(this, arguments_)
    }
    plugin.load = {...load, handler: wrapped}
  }

  const transform = plugin.transform
  if (typeof transform === 'function') {
    const wrapped: typeof transform = function (...arguments_) {
      counts.transform += 1
      return transform.apply(this, arguments_)
    }
    plugin.transform = wrapped
  } else if (transform) {
    const {handler} = transform
    const wrapped: typeof handler = function (...arguments_) {
      counts.transform += 1
      return handler.apply(this, arguments_)
    }
    plugin.transform = {...transform, handler: wrapped}
  }

  return plugin
}

function instrumentPlugins(plugins: Plugin[], counts: HookCounts): Plugin[] {
  return plugins.map((plugin) => instrumentPlugin(plugin, counts))
}

async function collectHookCounts(
  fixture: FixtureDescription,
  plugin: VitePluginKind,
): Promise<HookDiagnosticResult> {
  const counts: HookCounts = {load: 0, resolveId: 0, transform: 0}
  const root = fixturePath(fixture)
  const cacheDirectory = path.join(root, `.vite-diagnostic-${plugin}`)
  await rm(cacheDirectory, {recursive: true, force: true})

  await build({
    root,
    cacheDir: cacheDirectory,
    clearScreen: false,
    configFile: false,
    logLevel: 'silent',
    plugins: instrumentPlugins(createVitePlugins(plugin), counts),
    build: {
      copyPublicDir: false,
      cssMinify: false,
      minify: false,
      reportCompressedSize: false,
      sourcemap: false,
      write: false,
    },
  })

  return {
    ...counts,
    plainModules: fixture.plainModules,
    plugin,
    styleModules: fixture.styleModules,
  }
}

export async function runHookDiagnostics(
  fixtures: FixtureDescription[],
): Promise<HookDiagnosticResult[]> {
  const results: HookDiagnosticResult[] = []
  for (const fixture of fixtures) {
    for (const plugin of ['official', 'sanity'] as const) {
      results.push(await collectHookCounts(fixture, plugin))
    }
  }

  // eslint-disable-next-line no-console
  console.log('JavaScript plugin hook entries (untimed diagnostic)')
  // eslint-disable-next-line no-console
  console.table(results)
  await mkdir(resultsRoot, {recursive: true})
  await writeFile(
    path.join(resultsRoot, 'vite-hook-counts.json'),
    `${JSON.stringify(results, null, 2)}\n`,
  )
  return results
}
