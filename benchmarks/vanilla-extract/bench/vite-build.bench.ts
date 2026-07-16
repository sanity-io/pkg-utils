import path from 'node:path'
import {bench, describe} from 'vitest'
import {runViteBuild} from './helpers/commands.ts'
import {coldBuildOptions} from './helpers/options.ts'
import {assertViteOutputSync} from './helpers/output.ts'
import {fixturePath, generatedRoot, loadFixtureManifest} from './helpers/paths.ts'

const manifest = await loadFixtureManifest()
const fixtureRoot = fixturePath(manifest.representative)
const heavyFixtureRoot = fixturePath(manifest.heavy)

// No minify/target variants here: in the Vite comparison those are handled by Vite itself,
// identically for both plugins, so they would only add identical work to both sides. The
// library-build benchmark covers the variant matrix where each plugin owns that work.
// Identifier formatting is varied: the `debug` case runs each plugin's per-module debug-ID
// source transform (babel in `@vanilla-extract/integration`, a yuku-parser AST pass in
// `@sanity/vanilla-extract-integration`), which the `short` case skips entirely.
for (const identifiers of ['short', 'debug'] as const) {
  describe(`vite build, ${identifiers} identifiers (${manifest.representative.plainModules} TS + ${manifest.representative.styleModules} CSS modules)`, () => {
    for (const plugin of ['official', 'sanity'] as const) {
      const outputDirectory = path.join(generatedRoot, `output/vite-build-${plugin}-${identifiers}`)
      const packageName =
        plugin === 'official'
          ? '@vanilla-extract/vite-plugin'
          : '@sanity/vanilla-extract-vite-plugin'

      bench(
        `Vite 8 + ${packageName}`,
        async () => {
          await runViteBuild(fixtureRoot, outputDirectory, plugin, {identifiers})
        },
        coldBuildOptions('build', outputDirectory, () => assertViteOutputSync(outputDirectory)),
      )
    }
  })
}

// The kitchen-sink case: an app-scale module graph built with dev-default debug identifiers
// and a production CSS pipeline (minify + chrome61 lowering, handled by Vite identically for
// both plugins) — the scenario where the per-module debug-ID transform dominates the plugin's
// share of the build.
describe(`vite build, kitchen sink: debug identifiers, css minify + target chrome61 (${manifest.heavy.plainModules} TS + ${manifest.heavy.styleModules} CSS modules)`, () => {
  for (const plugin of ['official', 'sanity'] as const) {
    const outputDirectory = path.join(generatedRoot, `output/vite-build-${plugin}-heavy`)
    const packageName =
      plugin === 'official' ? '@vanilla-extract/vite-plugin' : '@sanity/vanilla-extract-vite-plugin'

    bench(
      `Vite 8 + ${packageName}`,
      async () => {
        await runViteBuild(heavyFixtureRoot, outputDirectory, plugin, {
          identifiers: 'debug',
          cssMinify: true,
          cssTarget: 'chrome61',
        })
      },
      coldBuildOptions('build', outputDirectory, () => assertViteOutputSync(outputDirectory)),
    )
  }
})
