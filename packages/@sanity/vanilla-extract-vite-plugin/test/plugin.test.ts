import {mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {normalizePath} from '@sanity/vanilla-extract-integration'
import {build, createServer, type Plugin, type Rollup} from 'vite'
import {afterEach, describe, expect, test} from 'vitest'
import {createCompiler, vanillaExtractPlugin, type Compiler} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, 'fixtures/app')
const mutableRoot = path.resolve(__dirname, 'fixtures/mutable')

const stylesCssTs = path.join(appRoot, 'src/styles.css.ts')
const themeTs = path.join(appRoot, 'src/theme.ts')
const mutableStylesCssTs = path.join(mutableRoot, 'src/styles.css.ts')

/**
 * (Re-)generates the gitignored mutable fixture with the given colour marker, so state leaked
 * by a crashed or timed-out earlier run can't poison the current one.
 */
async function writeMutableFixture(color: string): Promise<void> {
  await mkdir(path.dirname(mutableStylesCssTs), {recursive: true})
  await writeFile(
    mutableStylesCssTs,
    [
      `import {style} from '@vanilla-extract/css'`,
      ``,
      `export const box: string = style({`,
      `  color: '${color}',`,
      `})`,
      ``,
    ].join('\n'),
  )
}

/** Matches either the authored `rgb(1, 2, 3)` marker or its minified `#010203` form. */
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

const compilersToClose: Compiler[] = []
afterEach(async () => {
  await Promise.all(compilersToClose.splice(0).map((compiler) => compiler.close()))
})

function createTestCompiler(
  root: string,
  enableFileWatcher = false,
  viteConfig?: Parameters<typeof createCompiler>[0]['viteConfig'],
): Compiler {
  const compiler = createCompiler({root, identifiers: 'debug', enableFileWatcher, viteConfig})
  compilersToClose.push(compiler)
  return compiler
}

describe('vite build', () => {
  test('feeds the extracted CSS through Vite’s CSS pipeline', async () => {
    const result = await build({
      root: appRoot,
      configFile: false,
      logLevel: 'silent',
      plugins: [vanillaExtractPlugin()],
      build: {write: false},
    })
    const {output} = Array.isArray(result) ? result[0]! : (result as Rollup.RollupOutput)

    // The CSS of both `.css.ts` modules is bundled by Vite's CSS pipeline (not by this plugin)
    const css = findCssAsset(output)
    expect(containsBoxMarker(css)).toBe(true)
    expect(css.includes('rgb(4, 5, 6)') || css.includes('#040506')).toBe(true)

    // The JS output exports the class names but carries no styles
    const entry = output.find(
      (assetOrChunk) => assetOrChunk.type === 'chunk' && assetOrChunk.isEntry,
    )
    if (!entry || entry.type !== 'chunk') expect.unreachable('expected an entry chunk')
    expect(entry.code).toContain('className')
    expect(entry.code).not.toContain('rgb(1, 2, 3)')

    // Vite links the CSS from the HTML entry - the extract never leaves its pipeline
    const html = output.find(
      (assetOrChunk) => assetOrChunk.type === 'asset' && assetOrChunk.fileName === 'index.html',
    )
    if (!html || html.type !== 'asset') expect.unreachable('expected the index.html asset')
    expect(String(html.source)).toMatch(/<link rel="stylesheet"[^>]+\.css/)
  })

  // Regression for https://github.com/sanity-io/pkg-utils/issues/3073: `sanity build` enables
  // the `browser` resolve condition on the parent Vite config. The compiler must strip that
  // when evaluating `.css.ts` — otherwise `@vanilla-extract/css` resolves to its browser
  // build, class names still export, and the CSS bundle stays empty.
  test('still extracts CSS when the parent config enables the browser resolve condition', async () => {
    const result = await build({
      root: appRoot,
      configFile: false,
      logLevel: 'silent',
      plugins: [vanillaExtractPlugin()],
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
      build: {write: false},
    })
    const {output} = Array.isArray(result) ? result[0]! : (result as Rollup.RollupOutput)

    const css = findCssAsset(output)
    expect(containsBoxMarker(css)).toBe(true)
    expect(css.includes('rgb(4, 5, 6)') || css.includes('#040506')).toBe(true)

    const entry = output.find(
      (assetOrChunk) => assetOrChunk.type === 'chunk' && assetOrChunk.isEntry,
    )
    if (!entry || entry.type !== 'chunk') expect.unreachable('expected an entry chunk')
    expect(entry.code).toContain('className')
  })
})

describe('vite dev', () => {
  test('serves `.css.ts` modules as JS with virtual `.vanilla.css` imports', async () => {
    const server = await createServer({
      root: appRoot,
      configFile: false,
      logLevel: 'silent',
      server: {middlewareMode: true},
      plugins: [vanillaExtractPlugin()],
    })
    try {
      const transformed = await server.transformRequest('/src/styles.css.ts')
      expect(transformed).toBeTruthy()

      // The module exports the class name and imports its CSS as a virtual module
      expect(transformed?.code).toContain('export var box')
      expect(transformed?.code).not.toContain('rgb(1, 2, 3)')
      const virtualImport = transformed?.code.match(/import\s+["']([^"']+\.vanilla\.css[^"']*)["']/)
      expect(virtualImport).toBeTruthy()

      // The virtual module resolves through Vite's CSS pipeline (served as a JS module in dev)
      const css = await server.transformRequest(virtualImport![1]!)
      expect(css?.code).toContain('rgb(1, 2, 3)')
    } finally {
      await server.close()
    }
  })

  test.each([
    // The marker plugin only affects the extracted CSS when it runs inside the compiler
    // server: the consuming server's `.css.ts` transforms are discarded (the compiler reads
    // from disk), so a rewritten marker proves the plugin was forwarded - and by default no
    // plugins are forwarded (the built-in `resolve.tsconfigPaths` replaces the
    // `vite-tsconfig-paths` plugin upstream forwards on Vite 8)
    ['forwards no plugins to the compiler server by default', undefined, 'rgb(1, 2, 3)'],
    [
      'forwards the plugins a `pluginFilter` selects to the compiler server',
      ({name}: {name: string}) => name === 'css-marker-rewrite',
      'rgb(9, 9, 9)',
    ],
  ] as const)('%s', async (_title, pluginFilter, expectedColor) => {
    // Rewrites the colour constant in `theme.ts` (a dependency of `styles.css.ts`), so the
    // extracted CSS only changes when the plugin runs inside the compiler server
    const markerPlugin: Plugin = {
      name: 'css-marker-rewrite',
      transform(code, id) {
        const [validId = id] = id.split('?')
        if (!validId.endsWith('theme.ts')) return null
        return {code: code.replaceAll('rgb(1, 2, 3)', 'rgb(9, 9, 9)'), map: null}
      },
    }
    const server = await createServer({
      root: appRoot,
      configFile: false,
      logLevel: 'silent',
      server: {middlewareMode: true},
      // The marker plugin is nested like a preset would produce - `PluginOption` arrays nest
      // arbitrarily deep, and forwarding must flatten them fully
      plugins: [vanillaExtractPlugin({pluginFilter}), [[markerPlugin]]],
    })
    try {
      const transformed = await server.transformRequest('/src/styles.css.ts')
      const virtualImport = transformed?.code.match(/import\s+["']([^"']+\.vanilla\.css[^"']*)["']/)
      const css = await server.transformRequest(virtualImport![1]!)
      expect(css?.code).toContain(expectedColor)
    } finally {
      await server.close()
    }
  })

  test('evaluates `.css.ts` modules in SSR', async () => {
    const server = await createServer({
      root: appRoot,
      configFile: false,
      logLevel: 'silent',
      server: {middlewareMode: true},
      plugins: [vanillaExtractPlugin()],
    })
    try {
      // The SSR pipeline compiles the module the same way; the virtual CSS import resolves
      // through Vite's CSS handling (a no-op module in SSR) instead of crashing on `.css`
      const module_ = (await server.ssrLoadModule('/src/styles.css.ts')) as {box: string}
      expect(module_.box).toMatch(/box/)
    } finally {
      await server.close()
    }
  })

  test('`hotUpdate` invalidates the virtual CSS modules of the importer chain', async () => {
    const plugins = vanillaExtractPlugin()
    const server = await createServer({
      root: appRoot,
      configFile: false,
      logLevel: 'silent',
      server: {middlewareMode: true},
      plugins: [plugins],
    })
    try {
      // Populate the client environment's module graph, including the virtual CSS module
      const transformed = await server.transformRequest('/src/styles.css.ts')
      const virtualImport = transformed?.code.match(/import\s+["']([^"']+\.vanilla\.css[^"']*)["']/)
      await server.transformRequest(virtualImport![1]!)

      const environment = server.environments.client
      const virtualModules = [
        ...(environment.moduleGraph.getModulesByFile(`${normalizePath(stylesCssTs)}.vanilla.css`) ??
          []),
      ]
      expect(virtualModules.length).toBeGreaterThan(0)
      expect(virtualModules.some((mod) => mod.transformResult)).toBe(true)

      // Simulate a change to `theme.ts` (a transitive dependency of `styles.css.ts`): the hook
      // reconstructs the importer chain from the compiler's module graph and invalidates the
      // virtual CSS module in this environment's graph
      const plugin = plugins.find((candidate) => candidate.name === 'sanity-vanilla-extract')
      const hotUpdate = plugin?.hotUpdate
      const handler = typeof hotUpdate === 'object' ? hotUpdate.handler : hotUpdate
      if (!handler) expect.unreachable('expected a `hotUpdate` hook')
      await handler.call({environment} as never, {
        type: 'update',
        file: normalizePath(themeTs),
        timestamp: Date.now(),
        modules: [],
        read: () => '',
        server,
      })

      expect(virtualModules.every((mod) => mod.transformResult === null)).toBe(true)
    } finally {
      await server.close()
    }
  })

  test('declares plugin hook filters', () => {
    // Regression guard for the rolldown-vite Rust ↔ JS roundtrip
    // (https://github.com/vanilla-extract-css/vanilla-extract/issues/1641): the hooks are
    // object hooks with id filters
    const plugins = vanillaExtractPlugin()
    const plugin = plugins.find((candidate) => candidate.name === 'sanity-vanilla-extract')
    if (!plugin) expect.unreachable('expected the main plugin')

    const {transform, resolveId, load} = plugin
    if (
      typeof transform !== 'object' ||
      typeof resolveId !== 'object' ||
      typeof load !== 'object'
    ) {
      expect.unreachable('expected the transform, resolveId and load hooks to be object hooks')
    }
    expect(transform.filter).toMatchObject({id: expect.any(RegExp)})
    expect(resolveId.filter).toMatchObject({id: expect.any(RegExp)})
    expect(load.filter).toMatchObject({id: expect.any(RegExp)})

    // The transform filter tolerates the id queries Vite appends in dev (`?t=…` after an HMR
    // invalidation), which the query-less `cssFileFilter` regex would reject
    const transformFilter = (transform.filter as {id: RegExp}).id
    expect(transformFilter.test('/app/src/styles.css.ts')).toBe(true)
    expect(transformFilter.test('/app/src/styles.css.ts?t=1234')).toBe(true)
    expect(transformFilter.test('/app/src/unrelated.ts')).toBe(false)
  })

  test('only enables the inline-dev-css plugin for `mode: "inlineCssInDev"` in serve', () => {
    const [inlineCssPlugin] = vanillaExtractPlugin({mode: 'inlineCssInDev'})
    if (!inlineCssPlugin || typeof inlineCssPlugin.apply !== 'function') {
      expect.unreachable('expected the inline-dev-css plugin with an `apply` function')
    }
    expect(inlineCssPlugin.apply({}, {command: 'serve', mode: 'development'})).toBe(true)
    expect(inlineCssPlugin.apply({}, {command: 'build', mode: 'production'})).toBe(false)

    const [emitCssInlinePlugin] = vanillaExtractPlugin()
    if (!emitCssInlinePlugin || typeof emitCssInlinePlugin.apply !== 'function') {
      expect.unreachable('expected the inline-dev-css plugin with an `apply` function')
    }
    expect(emitCssInlinePlugin.apply({}, {command: 'serve', mode: 'development'})).toBe(false)
  })
})

describe('compiler', () => {
  test('caches processed files in the module graph', async () => {
    const compiler = createTestCompiler(appRoot)

    const first = await compiler.processVanillaFile(stylesCssTs)
    expect(first.source).toContain('export var box')
    expect(first.source).toContain('.vanilla.css')

    // Unchanged module: the memoized result object itself is returned
    const second = await compiler.processVanillaFile(stylesCssTs)
    expect(second).toBe(first)
  })

  test('strips browser from compiler resolve conditions but forwards other parent conditions', async () => {
    // Vite 8 merges `resolve` / `ssr.resolve` / `environments.ssr.resolve` conditions, so
    // `browser` must be filtered from all three (a top-level-only filter still leaves it in the
    // SSR environment's merged list). Custom conditions like `development` stay forwarded.
    let compilerResolveConditions: readonly string[] | undefined
    let compilerSsrConditions: readonly string[] | undefined
    let compilerEnvSsrConditions: readonly string[] | undefined
    let compilerMainFields: readonly string[] | undefined

    const compiler = createTestCompiler(appRoot, false, {
      resolve: {
        conditions: ['browser', 'development', 'module', 'import', 'default'],
        mainFields: ['browser', 'module', 'jsnext:main', 'jsnext', 'main'],
      },
      ssr: {
        resolve: {
          conditions: ['browser', 'development', 'module', 'import', 'default'],
          externalConditions: ['browser', 'development', 'module', 'import', 'default'],
        },
      },
      environments: {
        ssr: {
          resolve: {
            conditions: ['browser', 'development', 'module', 'import', 'default'],
            externalConditions: ['browser', 'development', 'module', 'import', 'default'],
          },
        },
      },
      plugins: [
        {
          name: 'capture-compiler-resolve-conditions',
          configResolved(config) {
            compilerResolveConditions = config.resolve.conditions
            compilerSsrConditions = config.ssr.resolve?.conditions
            compilerEnvSsrConditions = config.environments['ssr']?.resolve.conditions
            compilerMainFields = config.resolve.mainFields
          },
        },
      ],
    })

    const {source} = await compiler.processVanillaFile(stylesCssTs)
    expect(source).toContain('export var box')
    expect(source).toContain('.vanilla.css')
    expect(compiler.getCssForFile(stylesCssTs)?.css).toContain('rgb(1, 2, 3)')

    for (const conditions of [
      compilerResolveConditions,
      compilerSsrConditions,
      compilerEnvSsrConditions,
    ]) {
      expect(conditions).toBeTruthy()
      expect(conditions).toContain('development')
      expect(conditions).toContain('module')
      expect(conditions).not.toContain('browser')
    }
    expect(compilerMainFields).toContain('module')
    expect(compilerMainFields).not.toContain('browser')
  })

  test('exposes the extracted CSS per file and in aggregate', async () => {
    const compiler = createTestCompiler(appRoot)
    await compiler.processVanillaFile(stylesCssTs)
    await compiler.processVanillaFile(path.join(appRoot, 'src/button.css.ts'))

    expect(compiler.getCssForFile(stylesCssTs)?.css).toContain('rgb(1, 2, 3)')
    expect(compiler.getCssForFile(themeTs)).toBeUndefined()

    // `getAllCss` powers the `inlineCssInDev` mode
    const allCss = compiler.getAllCss()
    expect(allCss).toContain('rgb(1, 2, 3)')
    expect(allCss).toContain('rgb(4, 5, 6)')
  })

  test('collects transitive watch files', async () => {
    const compiler = createTestCompiler(appRoot)
    const {watchFiles} = await compiler.processVanillaFile(stylesCssTs)

    // `styles.css.ts` imports the plain `theme.ts`, which must be watched for the CSS to be
    // recompiled when it changes
    expect([...watchFiles].some((file) => normalizePath(file).endsWith('src/theme.ts'))).toBe(true)
  })

  test('reconstructs the importer tree from its own module graph', async () => {
    const compiler = createTestCompiler(appRoot)
    await compiler.processVanillaFile(stylesCssTs)

    const importerChain = await compiler.findImporterTree(
      themeTs,
      new Set([normalizePath(stylesCssTs)]),
    )

    const ids = [...importerChain].map((mod) => mod.id)
    expect(ids).toContain(normalizePath(themeTs))
    expect(ids).toContain(normalizePath(stylesCssTs))
  })

  test('recompiles after explicit invalidation', async () => {
    await writeMutableFixture('rgb(1, 2, 3)')
    const compiler = createTestCompiler(mutableRoot)

    expect(compiler.getCssForFile(mutableStylesCssTs)).toBeUndefined()
    await compiler.processVanillaFile(mutableStylesCssTs)
    expect(compiler.getCssForFile(mutableStylesCssTs)?.css).toContain('rgb(1, 2, 3)')

    await writeMutableFixture('rgb(7, 8, 9)')
    await compiler.invalidateAllModules()

    await compiler.processVanillaFile(mutableStylesCssTs)
    expect(compiler.getCssForFile(mutableStylesCssTs)?.css).toContain('rgb(7, 8, 9)')
  })

  test('recompiles when the file watcher reports a change', async () => {
    await writeMutableFixture('rgb(1, 2, 3)')
    const compiler = createTestCompiler(mutableRoot, true)

    await compiler.processVanillaFile(mutableStylesCssTs)
    expect(compiler.getCssForFile(mutableStylesCssTs)?.css).toContain('rgb(1, 2, 3)')

    // The compiler's internal watcher invalidates both the server module graph and the
    // module runner cache. Re-touch the file while polling: a write that lands before the
    // watcher finished its initial scan is missed entirely.
    await expect
      .poll(
        async () => {
          await writeMutableFixture('rgb(7, 8, 9)')
          await compiler.processVanillaFile(mutableStylesCssTs)
          return compiler.getCssForFile(mutableStylesCssTs)?.css
        },
        {interval: 250, timeout: 10_000},
      )
      .toContain('rgb(7, 8, 9)')
  }, 15_000)

  test('prunes the extracted CSS of deleted files', async () => {
    await writeMutableFixture('rgb(1, 2, 3)')
    const compiler = createTestCompiler(mutableRoot, true)

    await compiler.processVanillaFile(mutableStylesCssTs)
    expect(compiler.getCssForFile(mutableStylesCssTs)?.css).toContain('rgb(1, 2, 3)')
    expect(compiler.getAllCss()).toContain('rgb(1, 2, 3)')

    // Confirm the watcher is live first (a deletion that lands before its initial scan is
    // missed entirely, and unlike the change test above, a deletion can't be re-triggered)
    await expect
      .poll(
        async () => {
          await writeMutableFixture('rgb(7, 8, 9)')
          await compiler.processVanillaFile(mutableStylesCssTs)
          return compiler.getCssForFile(mutableStylesCssTs)?.css
        },
        {interval: 250, timeout: 10_000},
      )
      .toContain('rgb(7, 8, 9)')

    // Nothing re-evaluates a deleted module, so the watcher's `unlink` handler must prune the
    // caches - otherwise `getAllCss()` (which powers `inlineCssInDev`) keeps serving its CSS
    await rm(mutableStylesCssTs)
    await expect
      .poll(() => compiler.getCssForFile(mutableStylesCssTs), {interval: 250, timeout: 10_000})
      .toBeUndefined()
    expect(compiler.getAllCss()).not.toContain('rgb(')
  }, 30_000)
})
