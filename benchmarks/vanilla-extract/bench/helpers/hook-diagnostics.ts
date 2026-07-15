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

type UnknownFunction = (this: unknown, ...arguments_: unknown[]) => unknown

function instrumentHook(plugin: Plugin, hookName: HookName, counts: HookCounts): Plugin {
  const source = plugin as unknown as Record<string, unknown>
  const hook = source[hookName]
  if (!hook) return plugin

  const clone = {...source}
  if (typeof hook === 'function') {
    const handler = hook as UnknownFunction
    clone[hookName] = function (this: unknown, ...arguments_: unknown[]) {
      counts[hookName] += 1
      return Reflect.apply(handler, this, arguments_)
    }
  } else if (typeof hook === 'object' && 'handler' in hook) {
    const objectHook = hook as Record<string, unknown>
    const handler = objectHook['handler']
    if (typeof handler !== 'function') return plugin

    clone[hookName] = {
      ...objectHook,
      handler(this: unknown, ...arguments_: unknown[]) {
        counts[hookName] += 1
        return Reflect.apply(handler as UnknownFunction, this, arguments_)
      },
    }
  }

  return clone as unknown as Plugin
}

function instrumentPlugins(plugins: Plugin[], counts: HookCounts): Plugin[] {
  return plugins.map((plugin) =>
    hookNames.reduce(
      (instrumented, hookName) => instrumentHook(instrumented, hookName, counts),
      plugin,
    ),
  )
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

  console.log('JavaScript plugin hook entries (untimed diagnostic)')
  console.table(results)
  await mkdir(resultsRoot, {recursive: true})
  await writeFile(
    path.join(resultsRoot, 'vite-hook-counts.json'),
    `${JSON.stringify(results, null, 2)}\n`,
  )
  return results
}
