/**
 * Studio-shaped parity: compare `@vanilla-extract/vite-plugin` (reference) with
 * `@sanity/vanilla-extract-vite-plugin` under the resolve/SSR conditions Sanity uses for
 * `sanity build` / `sanity schema extract`, plus identifier and CSS pipeline options.
 *
 * Soft parity only — class hashes may differ between `@vanilla-extract/integration` and
 * `@sanity/vanilla-extract-integration`. Absolute regressions (empty CSS, `module is not
 * defined`) always fail the Sanity side.
 */
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {build, createServer, type PluginOption, type Rollup} from 'vite'
import {describe, expect, test} from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, 'fixtures/app')
const studioSsrRoot = path.resolve(__dirname, 'fixtures/studio-ssr')

/** Parent resolve shape used by `sanity build` (browser-oriented application conditions). */
const studioBrowserResolve = {
  resolve: {
    conditions: ['browser', 'module', 'import', 'default'],
    mainFields: ['browser', 'module', 'jsnext:main', 'jsnext', 'main'],
  },
  ssr: {
    resolve: {
      conditions: ['browser', 'module', 'import', 'default'],
      externalConditions: ['browser', 'module', 'import', 'default'],
    },
  },
  environments: {
    client: {
      resolve: {
        conditions: ['browser', 'module', 'import', 'default'],
      },
    },
    ssr: {
      resolve: {
        conditions: ['browser', 'module', 'import', 'default'],
        externalConditions: ['browser', 'module', 'import', 'default'],
      },
    },
  },
}

function containsBoxMarker(css: string): boolean {
  return css.includes('rgb(1, 2, 3)') || css.includes('#010203')
}

function findCssAsset(output: readonly (Rollup.OutputAsset | Rollup.OutputChunk)[]): string {
  const asset = output.find(
    (assetOrChunk) => assetOrChunk.type === 'asset' && assetOrChunk.fileName.endsWith('.css'),
  )
  if (!asset || asset.type !== 'asset') {
    expect.unreachable('expected an emitted `.css` asset')
  }
  const {source} = asset
  return typeof source === 'string' ? source : new TextDecoder().decode(source)
}

async function loadOfficialPlugin(): Promise<() => PluginOption[]> {
  const mod = await import('@vanilla-extract/vite-plugin')
  return () => mod.vanillaExtractPlugin()
}

async function loadSanityPlugin(): Promise<
  (options?: {identifiers?: 'short' | 'debug'}) => PluginOption[]
> {
  const mod = await import('../src/index.ts')
  return (options) => mod.vanillaExtractPlugin(options)
}

describe('studio-shaped parity (official reference)', () => {
  test.each([
    {identifiers: 'debug' as const, cssMinify: false, cssTarget: undefined},
    {identifiers: 'short' as const, cssMinify: false, cssTarget: undefined},
    {identifiers: 'debug' as const, cssMinify: true, cssTarget: 'chrome61' as const},
    {identifiers: 'short' as const, cssMinify: true, cssTarget: 'chrome61' as const},
  ])(
    'vite build with browser conditions: identifiers=$identifiers minify=$cssMinify target=$cssTarget',
    async ({identifiers, cssMinify, cssTarget}) => {
      const officialPlugin = await loadOfficialPlugin()
      const sanityPlugin = await loadSanityPlugin()

      const run = async (plugins: PluginOption[]) => {
        const result = await build({
          root: appRoot,
          configFile: false,
          logLevel: 'silent',
          plugins,
          ...studioBrowserResolve,
          build: {
            write: false,
            cssMinify,
            ...(cssTarget ? {cssTarget} : undefined),
          },
        })
        const {output} = Array.isArray(result) ? result[0]! : (result as Rollup.RollupOutput)
        return findCssAsset(output)
      }

      // Sanity must always extract CSS under studio resolve conditions (#3073)
      const sanityCss = await run(sanityPlugin({identifiers}))
      expect(containsBoxMarker(sanityCss)).toBe(true)
      expect(sanityCss.includes('rgb(4, 5, 6)') || sanityCss.includes('#040506')).toBe(true)

      // Official is the reference when it also succeeds; it may still drop CSS under browser
      // conditions (same root cause) — soft-compare only when its bundle is non-empty.
      let officialCss: string | undefined
      try {
        officialCss = await run(officialPlugin())
      } catch {
        officialCss = undefined
      }
      if (officialCss && containsBoxMarker(officialCss)) {
        expect(containsBoxMarker(sanityCss)).toBe(containsBoxMarker(officialCss))
      }

      if (cssTarget === 'chrome61') {
        expect(sanityCss).not.toMatch(/\binset\s*:/)
      }
    },
  )

  test('ssrLoadModule with browser conditions + parent noExternal + CJS in the .css.ts graph', async () => {
    const sanityPlugin = await loadSanityPlugin()

    // Parent apps (and some Sanity SSR paths) set `ssr.noExternal: true`. Upstream's
    // vite-node compiler wants that; our ModuleRunner must not inherit it or CJS deps like
    // `picocolors` in the `.css.ts` graph throw `module is not defined` (TypeGen failure mode).
    const server = await createServer({
      root: studioSsrRoot,
      configFile: false,
      logLevel: 'silent',
      server: {middlewareMode: true},
      appType: 'custom',
      plugins: [sanityPlugin({identifiers: 'debug'})],
      ...studioBrowserResolve,
      ssr: {
        ...studioBrowserResolve.ssr,
        noExternal: true,
      },
    })
    try {
      const mod = (await server.ssrLoadModule('/src/main.ts')) as {default: string}
      expect(mod.default).toMatch(/box/)

      const transformed = await server.transformRequest('/src/styles.css.ts')
      expect(transformed?.code).toContain('.vanilla.css')
      const virtualImport = transformed?.code.match(/import\s+["']([^"']+\.vanilla\.css[^"']*)["']/)
      expect(virtualImport).toBeTruthy()
      const css = await server.transformRequest(virtualImport![1]!)
      expect(css?.code).toContain('rgb(1, 2, 3)')
      expect(css?.code).toContain('40rem')
    } finally {
      await server.close()
    }
  })

  test('official ssrLoadModule baseline (no browser conditions) still extracts CSS', async () => {
    const officialPlugin = await loadOfficialPlugin()
    const server = await createServer({
      root: appRoot,
      configFile: false,
      logLevel: 'silent',
      server: {middlewareMode: true},
      appType: 'custom',
      plugins: [officialPlugin()],
    })
    try {
      const mod = (await server.ssrLoadModule('/src/styles.css.ts')) as {box: string}
      expect(mod.box).toMatch(/box/)
    } finally {
      await server.close()
    }
  })
})
