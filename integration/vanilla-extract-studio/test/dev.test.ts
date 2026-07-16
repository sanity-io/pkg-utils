import {describe, expect, test} from 'vitest'
import {
  extractDevClassNames,
  extractVirtualCssImports,
  startSanityDev,
  type FixtureClassNames,
  type PluginImplementation,
} from './helpers.ts'
import {classNameExpectation, devVariants, type StudioVariant} from './variants.ts'

interface DevOutput {
  css: string
  classNames: FixtureClassNames
}

/**
 * Starts `sanity dev`, requests the transformed `.css.ts` modules like the browser would, and
 * follows their virtual `.vanilla.css` imports (with `?direct`, which serves the plain CSS
 * text) to collect the CSS the studio receives during development.
 */
async function collectDevOutput(
  implementation: PluginImplementation,
  variant: StudioVariant,
): Promise<DevOutput> {
  const server = await startSanityDev(implementation, variant.env)
  try {
    const modules = await Promise.all([
      server.fetchText('/src/styles.css.ts'),
      server.fetchText('/src/button.css.ts'),
    ])
    const exports: Record<string, string> = {}
    const cssImports = new Set<string>()
    for (const code of modules) {
      Object.assign(exports, extractDevClassNames(code))
      for (const specifier of extractVirtualCssImports(code)) cssImports.add(specifier)
    }
    for (const exportName of ['veStudioDialog', 'veStudioOverlay', 'veStudioButton']) {
      expect(exports[exportName], `expected ${exportName} in the transformed modules`).toBeTruthy()
    }
    expect(cssImports.size, 'expected virtual .vanilla.css imports in dev').toBeGreaterThan(0)
    const css = (
      await Promise.all(
        [...cssImports]
          .toSorted()
          .map((specifier) =>
            server.fetchText(specifier + (specifier.includes('?') ? '&direct' : '?direct')),
          ),
      )
    ).join('\n')
    return {
      css,
      classNames: {
        dialog: exports['veStudioDialog']!,
        overlay: exports['veStudioOverlay']!,
        button: exports['veStudioButton']!,
      },
    }
  } finally {
    await server.stop()
  }
}

describe('sanity dev', () => {
  test.each(devVariants.map((variant) => [variant.slug, variant] as const))(
    '%s: fork output matches the upstream reference',
    async (_slug, variant) => {
      // The upstream plugin is the reference for expected output
      const upstream = await collectDevOutput('upstream', variant)

      // Dev servers run in development mode, so plugin-default identifiers resolve to `debug`
      const {pattern, firstClassPrefixes} = classNameExpectation(variant.identifiers, 'debug')
      for (const [exportName, classList] of Object.entries(upstream.classNames)) {
        for (const className of classList.split(' ')) {
          expect(className, `${exportName} class ${className}`).toMatch(pattern)
          expect(upstream.css, `expected a CSS rule for ${exportName} (.${className})`).toContain(
            `.${className}`,
          )
        }
        if (firstClassPrefixes) {
          const prefix = firstClassPrefixes[exportName as keyof FixtureClassNames]
          expect(classList, `${exportName} debug ID`).toMatch(new RegExp(`^${prefix}`))
        }
      }
      // Dev CSS is never minified
      expect(upstream.css).toContain('rgb(1, 2, 3)')
      expect(upstream.css).toContain('rgb(4, 5, 6)')
      expect(upstream.css).toContain('40rem')

      const fork = await collectDevOutput('fork', variant)
      expect(fork.classNames).toEqual(upstream.classNames)
      expect(fork.css).toBe(upstream.css)
    },
  )
})
