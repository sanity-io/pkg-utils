import path from 'node:path'
import {bench, describe} from 'vitest'
import {runViteBuild} from './helpers/commands.ts'
import {coldBuildOptions} from './helpers/options.ts'
import {assertViteOutput} from './helpers/output.ts'
import {fixturePath, generatedRoot, loadFixtureManifest} from './helpers/paths.ts'

const manifest = await loadFixtureManifest()
const fixtureRoot = fixturePath(manifest.representative)

describe(`vite build (${manifest.representative.plainModules} TS + ${manifest.representative.styleModules} CSS modules)`, () => {
  for (const plugin of ['official', 'sanity'] as const) {
    const outputDirectory = path.join(generatedRoot, `output/vite-build-${plugin}`)
    const packageName =
      plugin === 'official' ? '@vanilla-extract/vite-plugin' : '@sanity/vanilla-extract-vite-plugin'

    bench(
      `Vite 8 + ${packageName}`,
      async () => {
        await runViteBuild(fixtureRoot, outputDirectory, plugin)
      },
      coldBuildOptions('build', outputDirectory, () => assertViteOutput(outputDirectory)),
    )
  }
})
