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
  assertIdentifierFormat(css, variant.identifiers)
}

/**
 * With `debug` identifiers, the injected debug IDs (derived from the fixtures'
 * `export const className… = style(…)` declarations) must appear in the generated class
 * names; with `short`, class names are bare hashes and the export names never surface.
 */
function assertIdentifierFormat(css: string, identifiers: BuildVariant['identifiers']): void {
  if (identifiers === 'debug') {
    expect(css).toMatch(/className\d+__/)
  } else {
    expect(css).not.toContain('className')
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

  // No minify/target variants here: Vite handles those itself, identically for both plugins.
  // Identifier formatting is varied, matching the benchmark matrix.
  test.each([
    ['official', 'short'],
    ['official', 'debug'],
    ['sanity', 'short'],
    ['sanity', 'debug'],
  ] as const)(
    'Vite + %s plugin emits an application and extracted CSS with %s identifiers',
    async (plugin, identifiers) => {
      const outputDirectory = path.join(generatedRoot, `output/smoke-vite-${plugin}-${identifiers}`)
      await rm(outputDirectory, {recursive: true, force: true})
      await runViteBuild(fixtureRoot, outputDirectory, plugin, {identifiers})
      await assertViteOutput(outputDirectory)
      const css = readCssOutputSync(outputDirectory)
      expect(css).toContain('rgb(1, 2, 3)')
      assertIdentifierFormat(css, identifiers)
    },
    120_000,
  )
})
