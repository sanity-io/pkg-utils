import path from 'node:path'
import {bench, describe} from 'vitest'
import {runRolldownBuild, runRollupBuild} from './helpers/commands.ts'
import {coldBuildOptions} from './helpers/options.ts'
import {assertLibraryOutput} from './helpers/output.ts'
import {fixturePath, generatedRoot, loadFixtureManifest} from './helpers/paths.ts'

const manifest = await loadFixtureManifest()
const fixtureRoot = fixturePath(manifest.representative)

describe(`library build (${manifest.representative.plainModules} TS + ${manifest.representative.styleModules} CSS modules)`, () => {
  const rollupOutput = path.join(generatedRoot, 'output/build-rollup')
  bench(
    'Rollup + @vanilla-extract/rollup-plugin',
    async () => {
      await runRollupBuild(fixtureRoot, rollupOutput)
    },
    coldBuildOptions('build', rollupOutput, () => assertLibraryOutput(rollupOutput)),
  )

  const rolldownOutput = path.join(generatedRoot, 'output/build-rolldown')
  bench(
    'Rolldown + @sanity/vanilla-extract-rolldown-plugin',
    async () => {
      await runRolldownBuild(fixtureRoot, rolldownOutput)
    },
    coldBuildOptions('build', rolldownOutput, () => assertLibraryOutput(rolldownOutput)),
  )
})
