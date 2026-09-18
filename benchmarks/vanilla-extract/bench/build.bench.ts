import path from 'node:path'
import {describe, test} from 'vitest'
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
    test('Rollup + @vanilla-extract/rollup-plugin', async ({bench}) => {
      await bench('Rollup + @vanilla-extract/rollup-plugin', async () => {
        await runRollupBuild(fixtureRoot, rollupOutput, variant)
      }).run(coldBuildOptions('build', rollupOutput, () => assertLibraryOutputSync(rollupOutput)))
    })

    const rolldownOutput = path.join(generatedRoot, `output/build-rolldown-${variant.slug}`)
    test('Rolldown + @sanity/vanilla-extract-rolldown-plugin', async ({bench}) => {
      await bench('Rolldown + @sanity/vanilla-extract-rolldown-plugin', async () => {
        await runRolldownBuild(fixtureRoot, rolldownOutput, variant)
      }).run(
        coldBuildOptions('build', rolldownOutput, () => assertLibraryOutputSync(rolldownOutput)),
      )
    })
  })
}
