import path from 'node:path'
import {bench, describe} from 'vitest'
import {runRolldownBuild, runRollupBuild} from './helpers/commands.ts'
import {coldBuildOptions} from './helpers/options.ts'
import {assertLibraryOutputSync} from './helpers/output.ts'
import {fixturePath, generatedRoot, loadFixtureManifest} from './helpers/paths.ts'
import {buildVariants} from './helpers/variants.ts'

const manifest = await loadFixtureManifest()
const fixtureRoot = fixturePath(manifest.representative)

for (const variant of buildVariants) {
  describe(`library build, ${variant.label} (${manifest.representative.plainModules} TS + ${manifest.representative.styleModules} CSS modules)`, () => {
    const rollupOutput = path.join(generatedRoot, `output/build-rollup-${variant.slug}`)
    bench(
      'Rollup + @vanilla-extract/rollup-plugin',
      async () => {
        await runRollupBuild(fixtureRoot, rollupOutput, variant)
      },
      coldBuildOptions('build', rollupOutput, () => assertLibraryOutputSync(rollupOutput)),
    )

    const rolldownOutput = path.join(generatedRoot, `output/build-rolldown-${variant.slug}`)
    bench(
      'Rolldown + @sanity/vanilla-extract-rolldown-plugin',
      async () => {
        await runRolldownBuild(fixtureRoot, rolldownOutput, variant)
      },
      coldBuildOptions('build', rolldownOutput, () => assertLibraryOutputSync(rolldownOutput)),
    )
  })
}
