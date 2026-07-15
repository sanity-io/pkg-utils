import {rm} from 'node:fs/promises'
import path from 'node:path'
import {describe, expect, test} from 'vitest'
import {runRolldownBuild, runRollupBuild, runViteBuild} from '../bench/helpers/commands.ts'
import {assertLibraryOutput, assertViteOutput, readCssOutputSync} from '../bench/helpers/output.ts'
import {fixturePath, generatedRoot, loadFixtureManifest} from '../bench/helpers/paths.ts'
import {buildVariants, type BuildVariant} from '../bench/helpers/variants.ts'

const manifest = await loadFixtureManifest()
const fixtureRoot = fixturePath(manifest.representative)

/** The library-build pipelines own minify/target themselves, so both effects must show. */
function assertLibraryVariantCss(outputDirectory: string, variant: BuildVariant): void {
  const css = readCssOutputSync(outputDirectory)
  if (variant.minify || variant.target) {
    // lightningcss normalizes the marker to hex whenever it transforms, minified or not
    expect(css).toContain('#010203')
    expect(css).not.toContain('rgb(1, 2, 3)')
  } else {
    expect(css).toContain('rgb(1, 2, 3)')
  }
  if (variant.target) {
    // chrome61 predates the `inset` shorthand, so it must be lowered to `top`/`right`/…
    expect(css).not.toMatch(/inset\s*:/)
    expect(css).toMatch(/top\s*:/)
  } else {
    expect(css).toMatch(/inset\s*:/)
  }
}

const variantCases = buildVariants.map((variant) => [variant.label, variant] as const)

describe('benchmark configurations', () => {
  describe.each([
    ['Rollup + official plugin', 'rollup', runRollupBuild],
    ['Rolldown + Sanity plugin', 'rolldown', runRolldownBuild],
  ] as const)('%s', (_name, slug, runBuild) => {
    test.each(variantCases)(
      'emits executable JavaScript and correct CSS with %s',
      async (_label, variant) => {
        const outputDirectory = path.join(generatedRoot, `output/smoke-${slug}-${variant.slug}`)
        await rm(outputDirectory, {recursive: true, force: true})
        await runBuild(fixtureRoot, outputDirectory, variant)
        await assertLibraryOutput(outputDirectory)
        assertLibraryVariantCss(outputDirectory, variant)
      },
      120_000,
    )
  })

  describe.each(['official', 'sanity'] as const)('Vite + %s plugin', (plugin) => {
    test.each(variantCases)(
      'emits an application and extracted CSS with %s',
      async (_label, variant) => {
        const outputDirectory = path.join(
          generatedRoot,
          `output/smoke-vite-${plugin}-${variant.slug}`,
        )
        await rm(outputDirectory, {recursive: true, force: true})
        await runViteBuild(fixtureRoot, outputDirectory, plugin, {variant})
        await assertViteOutput(outputDirectory)
        // Vite owns minification; downleveling only applies through its CSS minifier, so the
        // target-only variant is validated as a normal build
        const css = readCssOutputSync(outputDirectory)
        if (variant.minify) {
          expect(css).toContain('#010203')
        } else {
          expect(css).toContain('rgb(1, 2, 3)')
        }
      },
      120_000,
    )
  })
})
