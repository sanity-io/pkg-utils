import {rm} from 'node:fs/promises'
import path from 'node:path'
import {describe, expect, test} from 'vitest'
import {alignClassRecords, normalizeClassRecord, replaceClasses} from './compare.ts'
import {
  describeResult,
  outputRoot,
  readAllVeBindings,
  readBuildClassNames,
  readBuildCss,
  runSanityCommand,
  type FixtureClassNames,
  type PluginImplementation,
} from './helpers.ts'
import {buildVariants, classNameExpectation, type BuildVariant} from './variants.ts'

interface BuildOutput {
  css: string
  classNames: FixtureClassNames
  /** Every `veStudio…` binding, including the lazily loaded `veStudioLazyBadge`. */
  bindings: Record<string, string>
}

/**
 * Builds run with `--no-minify` so the JS output keeps the `veStudio…` binding names; CSS
 * minification is exercised separately through the `build.cssMinify` option (see
 * `test/variants.ts`).
 */
async function buildStudio(
  implementation: PluginImplementation,
  variant: BuildVariant,
): Promise<BuildOutput> {
  const outDir = path.join(outputRoot, 'build', `${implementation}-${variant.slug}`)
  await rm(outDir, {recursive: true, force: true})
  const result = await runSanityCommand(
    ['build', outDir, '--no-minify'],
    implementation,
    variant.env,
  )
  expect(result.exitCode, `sanity build (${implementation}): ${describeResult(result)}`).toBe(0)
  return {
    css: await readBuildCss(outDir),
    classNames: await readBuildClassNames(outDir),
    bindings: await readAllVeBindings(outDir),
  }
}

function expectClassNameFormat(output: BuildOutput, variant: BuildVariant): void {
  // Builds run in production mode, so plugin-default identifiers resolve to `short`
  const {pattern, firstClassPrefixes} = classNameExpectation(variant.identifiers, 'short')
  for (const [exportName, classList] of Object.entries(output.classNames)) {
    for (const className of classList.split(' ')) {
      expect(className, `${exportName} class ${className}`).toMatch(pattern)
      expect(output.css, `expected a CSS rule for ${exportName} (.${className})`).toContain(
        `.${className}`,
      )
    }
    if (firstClassPrefixes) {
      const prefix = firstClassPrefixes[exportName as keyof FixtureClassNames]
      expect(classList, `${exportName} debug ID`).toMatch(new RegExp(`^${prefix}`))
    }
  }
}

function expectCssMarkers(output: BuildOutput, variant: BuildVariant): void {
  const minified = variant.cssMinify === 'true' || variant.cssMinify === 'lightningcss'
  if (minified) {
    // Minifiers normalize the colour markers to hex
    expect(output.css).toContain('#010203')
    expect(output.css).toContain('#040506')
  } else {
    expect(output.css).toContain('rgb(1, 2, 3)')
    expect(output.css).toContain('rgb(4, 5, 6)')
  }
  expect(output.css).toContain('40rem')

  // The `veStudioOverlay` rule shows whether `cssTarget` lowering was applied
  const overlayClass = output.classNames.overlay
  const overlayRule = output.css.match(new RegExp(`\\.${overlayClass}[^{]*\\{([^}]*)\\}`))
  expect(overlayRule, `expected a CSS rule for .${overlayClass}`).toBeTruthy()
  if (variant.cssTarget === 'chrome61') {
    // chrome61 predates the `inset` shorthand, so it must be lowered to `top`/`right`/…
    expect(overlayRule![1]).not.toMatch(/inset\s*:/)
    expect(overlayRule![1]).toMatch(/top\s*:/)
  } else {
    expect(overlayRule![1]).toMatch(/inset\s*:/)
  }
}

describe('sanity build', () => {
  test.each(buildVariants.map((variant) => [variant.slug, variant] as const))(
    '%s: fork output structurally matches the upstream reference',
    async (_slug, variant) => {
      // The upstream plugin is the reference for expected output
      const upstream = await buildStudio('upstream', variant)
      expectClassNameFormat(upstream, variant)
      expectCssMarkers(upstream, variant)

      const fork = await buildStudio('fork', variant)
      expectClassNameFormat(fork, variant)
      expectCssMarkers(fork, variant)

      // The fork salts its file-scope hash with the package version and content (SAPP-4639)
      // while upstream hashes the bare `packageName + filePath`, so the class names
      // legitimately differ — compare everything except the salted hash values. The
      // alignment covers every binding (including the lazy badge, whose CSS ships in the
      // build output), not just the entry's three exports.
      const alignment = alignClassRecords(fork.bindings, upstream.bindings)
      expect(normalizeClassRecord(fork.bindings, alignment.forkToPlaceholder)).toEqual(
        normalizeClassRecord(upstream.bindings, alignment.upstreamToPlaceholder),
      )
      expect(replaceClasses(fork.css, alignment.forkToPlaceholder)).toBe(
        replaceClasses(upstream.css, alignment.upstreamToPlaceholder),
      )
    },
  )
})
