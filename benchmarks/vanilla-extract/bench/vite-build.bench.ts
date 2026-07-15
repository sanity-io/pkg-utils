import path from 'node:path'
import {bench, describe} from 'vitest'
import {runViteBuild} from './helpers/commands.ts'
import {coldBuildOptions} from './helpers/options.ts'
import {assertViteOutputSync} from './helpers/output.ts'
import {fixturePath, generatedRoot, loadFixtureManifest} from './helpers/paths.ts'
import {buildVariants} from './helpers/variants.ts'

const manifest = await loadFixtureManifest()
const fixtureRoot = fixturePath(manifest.representative)

for (const variant of buildVariants) {
  describe(`vite build, ${variant.label} (${manifest.representative.plainModules} TS + ${manifest.representative.styleModules} CSS modules)`, () => {
    for (const plugin of ['official', 'sanity'] as const) {
      const outputDirectory = path.join(
        generatedRoot,
        `output/vite-build-${variant.slug}-${plugin}`,
      )
      const packageName =
        plugin === 'official'
          ? '@vanilla-extract/vite-plugin'
          : '@sanity/vanilla-extract-vite-plugin'

      bench(
        `Vite 8 + ${packageName}`,
        async () => {
          await runViteBuild(fixtureRoot, outputDirectory, plugin, {variant})
        },
        coldBuildOptions('build', outputDirectory, () => assertViteOutputSync(outputDirectory)),
      )
    }
  })
}
