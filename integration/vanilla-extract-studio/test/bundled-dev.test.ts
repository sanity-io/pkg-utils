import {describe, expect, test} from 'vitest'
import {
  compileLazyChunk,
  extractDevClassNames,
  startSanityDev,
  studioRoot,
  type FixtureClassNames,
  type PluginImplementation,
} from './helpers.ts'
import {classNameExpectation} from './variants.ts'

/**
 * `sanity dev` with `unstable_bundledDev` (Vite's experimental bundled dev mode): the studio
 * is served as a Rolldown-bundled module graph, so — unlike the default unbundled dev server,
 * where node_modules dependencies are pre-bundled away by the dep optimizer — every module of
 * every dependency runs through the plugin pipeline, and dynamic imports become stub chunks
 * that are compiled on demand at first request.
 *
 * That combination is the environment of sanity-io/plugins#1553: `@bynder/compact-view` ships
 * `Styles.css.js` — a plain JS module exporting a CSS string, not a vanilla-extract module —
 * whose name matches vanilla-extract's `cssFileFilter`, inside a lazily imported modal. The
 * fixture mirrors it with `plain-css-js-dependency` (a `file:` dependency copied into
 * node_modules) consumed by the `React.lazy`-loaded `PlainCssJsInput`, alongside a real
 * `.css.ts` that also only enters the graph through that chunk. Processing the plain
 * `.css.js` module used to hang the fork's compiler until its module runner's 60s transport
 * timeout and then crash the dev server, which that studio worked around with a resolver
 * plugin; upstream handles it without one, and so must the fork.
 */
interface BundledDevOutput {
  classNames: FixtureClassNames
  lazyPatch: string
}

const lazyChunkModuleId = `${studioRoot}/src/PlainCssJsInput.tsx?rolldown-lazy=1`

async function collectBundledDevOutput(
  implementation: PluginImplementation,
): Promise<BundledDevOutput> {
  const server = await startSanityDev(implementation, {}, {bundledDev: true})
  try {
    expect(
      server.output(),
      'expected the CLI to announce Vite bundled dev mode — is `unstable_bundledDev` still wired up in sanity.cli.ts?',
    ).toContain('bundled dev mode')

    const entry = await server.fetchText('/assets/index.js')
    const exports = extractDevClassNames(entry)
    for (const exportName of ['veStudioDialog', 'veStudioOverlay', 'veStudioButton']) {
      expect(exports[exportName], `expected ${exportName} in the bundled entry`).toBeTruthy()
    }
    // The lazily imported input must not be part of the initial bundle, or the on-demand
    // compile below would not exercise anything
    expect(entry).not.toContain('veStudioLazyBadge')
    expect(entry).toContain('PlainCssJsInput-')

    let lazyPatch: string
    try {
      lazyPatch = await compileLazyChunk(server, entry, lazyChunkModuleId)
    } catch (error) {
      // The known failure mode is a hang: processing the plain `.css.js` module deadlocks the
      // compiler until its module runner's 60s transport timeout, crashing the dev server
      throw new Error(
        `On-demand chunk compilation failed (${implementation}): ${String(error)}\n--- sanity dev output ---\n${server.output()}`,
        {cause: error},
      )
    }

    // The chunk's real vanilla-extract module was compiled on demand: class-name export plus
    // its extracted CSS, served through a virtual `.vanilla.css` style-injection module
    const lazyExports = extractDevClassNames(lazyPatch)
    const badge = lazyExports['veStudioLazyBadge']
    expect(badge, 'expected veStudioLazyBadge in the lazy-compiled chunk').toBeTruthy()
    expect(badge).toMatch(classNameExpectation('default', 'debug').pattern)
    expect(lazyPatch).toContain(`.${badge} {`)
    expect(lazyPatch).toContain('rgb(7, 8, 9)')

    // The plain (non-vanilla-extract) `Styles.css.js` of the node_modules dependency was
    // evaluated by the vanilla-extract compiler without hanging it: its CSS string survives
    // as a JS export, and produces no CSS of its own
    expect(lazyPatch).toContain('.plain-css-js-dependency{color:rgb(201, 202, 203)}')
    expect(lazyPatch).not.toContain('Styles.css.js.vanilla.css')

    // The dev server survived the compile (the regression crashed the whole process)
    const entryAfter = await server.fetchText('/assets/index.js')
    expect(extractDevClassNames(entryAfter)['veStudioDialog']).toBe(exports['veStudioDialog'])

    return {
      classNames: {
        dialog: exports['veStudioDialog']!,
        overlay: exports['veStudioOverlay']!,
        button: exports['veStudioButton']!,
      },
      lazyPatch,
    }
  } finally {
    await server.stop()
  }
}

describe('sanity dev (bundled dev mode)', () => {
  test('fork output matches the upstream reference, including on-demand chunks with a plain .css.js dependency', async () => {
    // The upstream plugin is the reference for expected output
    const upstream = await collectBundledDevOutput('upstream')

    // Dev servers run in development mode, so plugin-default identifiers resolve to `debug`
    const {pattern} = classNameExpectation('default', 'debug')
    for (const [exportName, classList] of Object.entries(upstream.classNames)) {
      for (const className of classList.split(' ')) {
        expect(className, `${exportName} class ${className}`).toMatch(pattern)
      }
    }

    const fork = await collectBundledDevOutput('fork')
    expect(fork.classNames).toEqual(upstream.classNames)
    expect(fork.lazyPatch).toBe(upstream.lazyPatch)
  })
})
