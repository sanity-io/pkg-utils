import {rm} from 'node:fs/promises'
import path from 'node:path'
import {describe, test} from 'vitest'
import {runRolldownBuild, runRollupBuild, runViteBuild} from '../bench/helpers/commands.ts'
import {assertLibraryOutput, assertViteOutput} from '../bench/helpers/output.ts'
import {fixturePath, generatedRoot, loadFixtureManifest} from '../bench/helpers/paths.ts'

const manifest = await loadFixtureManifest()
const fixtureRoot = fixturePath(manifest.representative)

describe('benchmark configurations', () => {
  test.each([
    ['Rollup + official plugin', runRollupBuild],
    ['Rolldown + Sanity plugin', runRolldownBuild],
  ] as const)(
    '%s emits executable JavaScript and extracted CSS',
    async (name, runBuild) => {
      const outputDirectory = path.join(
        generatedRoot,
        `output/smoke-${name.toLowerCase().replaceAll(/[^a-z]+/g, '-')}`,
      )
      await rm(outputDirectory, {recursive: true, force: true})
      await runBuild(fixtureRoot, outputDirectory)
      await assertLibraryOutput(outputDirectory)
    },
    120_000,
  )

  test.each(['official', 'sanity'] as const)(
    'Vite + %s plugin emits an application and extracted CSS',
    async (plugin) => {
      const outputDirectory = path.join(generatedRoot, `output/smoke-vite-${plugin}`)
      await rm(outputDirectory, {recursive: true, force: true})
      await runViteBuild(fixtureRoot, outputDirectory, plugin)
      await assertViteOutput(outputDirectory)
    },
    120_000,
  )
})
