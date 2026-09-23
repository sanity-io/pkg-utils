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

/** The top-level rules of served CSS, sorted, so rule sets compare regardless of order. */
function topLevelRules(css: string): string[] {
  const rules: string[] = []
  let depth = 0
  let current: string[] = []
  for (const line of css.split('\n')) {
    if (!line && current.length === 0) continue
    current.push(line)
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length
    if (depth === 0) {
      rules.push(current.join('\n'))
      current = []
    }
  }
  return rules.toSorted((a, b) => a.localeCompare(b))
}

describe('sanity dev with `compilation: "whole-program"`', () => {
  // The fork-only mode has no upstream counterpart to match byte for byte: it serves the same
  // class names and the same rules as the upstream reference, from one program-wide virtual
  // stylesheet instead of one virtual module per `.css.ts` file, and in one program order
  // (dependencies first, then sorted paths, every conditional block after every unconditional
  // rule) rather than Vite's module order.
  const variant = devVariants.find(({slug}) => slug === 'defaults')!

  test('serves the upstream class names and rule set from one program stylesheet', async () => {
    const upstream = await collectDevOutput('upstream', variant)

    const server = await startSanityDev('fork', {...variant.env, VE_COMPILATION: 'whole-program'})
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
      // Every module imports the same program stylesheet
      expect([...cssImports]).toEqual([
        expect.stringMatching(/virtual:vanilla-extract-program\.vanilla\.css$/),
      ])
      const [programCss] = [...cssImports]
      const css = await server.fetchText(`${programCss}?direct`)

      expect({
        dialog: exports['veStudioDialog'],
        overlay: exports['veStudioOverlay'],
        button: exports['veStudioButton'],
      }).toEqual(upstream.classNames)

      // Every rule upstream serves for the requested modules is in the program stylesheet...
      const programRules = topLevelRules(css)
      expect(programRules).toEqual(expect.arrayContaining(topLevelRules(upstream.css)))
      // ...plus the rules of the discovered modules nothing has requested yet (the lazily
      // loaded `PlainCssJsInput.css.ts`), which per-module compilation only serves on request
      expect(programRules).toHaveLength(topLevelRules(upstream.css).length + 1)
      expect(css).toContain('PlainCssJsInput_veStudioLazyBadge__')
    } finally {
      await server.stop()
    }
  })
})
