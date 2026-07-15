import path from 'node:path'
import {beforeAll, bench, describe} from 'vitest'
import {runViteBuild, type CommandResult} from './helpers/commands.ts'
import {runHookDiagnostics} from './helpers/hook-diagnostics.ts'
import {coldBuildOptions} from './helpers/options.ts'
import {assertViteOutputSync} from './helpers/output.ts'
import {fixturePath, generatedRoot, loadFixtureManifest} from './helpers/paths.ts'

const manifest = await loadFixtureManifest()
const surfacedWarnings = new Set<string>()

beforeAll(async () => {
  await runHookDiagnostics(manifest.stress)
}, 300_000)

function surfacePluginTimingWarning(name: string, result: CommandResult | undefined): void {
  if (!result || surfacedWarnings.has(name)) return
  const output = `${result.stdout}\n${result.stderr}`
  if (!output.includes('[PLUGIN_TIMINGS]')) return

  surfacedWarnings.add(name)
  // eslint-disable-next-line no-console
  console.warn(`Rolldown plugin timing diagnostic for ${name}:\n${output.trim()}`)
}

for (const fixture of manifest.stress) {
  describe(`${fixture.plainModules} unrelated TS modules`, () => {
    for (const plugin of ['official', 'sanity'] as const) {
      const name =
        plugin === 'official'
          ? '@vanilla-extract/vite-plugin'
          : '@sanity/vanilla-extract-vite-plugin'
      const outputDirectory = path.join(
        generatedRoot,
        `output/vite-hooks-${fixture.plainModules}-${plugin}`,
      )
      let lastResult: CommandResult | undefined

      bench(
        name,
        async () => {
          lastResult = await runViteBuild(fixturePath(fixture), outputDirectory, plugin, true)
        },
        coldBuildOptions('stress', outputDirectory, () => {
          assertViteOutputSync(outputDirectory)
          surfacePluginTimingWarning(`${fixture.plainModules}/${plugin}`, lastResult)
        }),
      )
    }
  })
}
