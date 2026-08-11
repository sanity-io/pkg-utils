import type {TsdownPlugin, UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

describe('dts option', () => {
  test('is undefined by default, so tsdown auto-detects it from package.json', async () => {
    expect((await defineConfig()).dts).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    expect((await defineConfig({dts: false})).dts).toBe(false)
    expect((await defineConfig({dts: true})).dts).toBe(true)
    expect((await defineConfig({dts: {tsgo: true}})).dts).toEqual({tsgo: true})
    expect((await defineConfig({dts: {sourcemap: true, oxc: false}})).dts).toEqual({
      sourcemap: true,
      oxc: false,
    })
  })
})

describe('tsdoc option', () => {
  test('is off by default', async () => {
    expect((await defineConfig()).hooks).toBeUndefined()
    expect((await defineConfig({tsdoc: false})).hooks).toBeUndefined()
  })

  test('registers a build:done hook when enabled', async () => {
    expect(typeof (await defineConfig({tsdoc: true})).hooks).toBe('function')
    expect(
      typeof (
        await defineConfig({
          tsdoc: {rules: {'ae-missing-release-tag': 'off'}},
        })
      ).hooks,
    ).toBe('function')
  })

  test('exposes checkTsdoc from the /tsdoc subpath, not the root', async () => {
    await expect(import('@sanity/tsdown-config')).resolves.not.toHaveProperty('checkTsdoc')
    await expect(import('@sanity/tsdown-config/tsdoc')).resolves.toEqual(
      expect.objectContaining({checkTsdoc: expect.any(Function)}),
    )
  })

  test('registers namespace release-tag repair only for declaration builds with TSDoc', async () => {
    expect(inputPlugins(await defineConfig({dts: true, tsdoc: false}))).toBeUndefined()
    expect(inputPlugins(await defineConfig({dts: false, tsdoc: true}))).toBeUndefined()

    for (const config of [
      await defineConfig({dts: true, tsdoc: true}),
      // An omitted dts option lets tsdown enable declarations from package.json.
      await defineConfig({tsdoc: true}),
    ]) {
      expect(inputPlugins(config)).toEqual([
        expect.objectContaining({name: 'sanity-namespace-release-tags'}),
      ])
    }
  })
})

function inputPlugins(config: UserConfig) {
  return typeof config.inputOptions === 'function' ? undefined : config.inputOptions?.plugins
}

describe('define option', () => {
  test('is undefined by default', async () => {
    expect((await defineConfig()).define).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    const define = {'process.env.NODE_ENV': JSON.stringify('production')}
    expect((await defineConfig({define})).define).toEqual(define)
  })
})

describe('target option', () => {
  test('is undefined by default, so tsdown applies no syntax downleveling', async () => {
    expect((await defineConfig()).target).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    // tsdown resolves the target into `ResolvedConfig.target`, where plugins pick it up - e.g.
    // `@sanity/vanilla-extract-tsdown-plugin` uses it as the default CSS syntax lowering target
    expect((await defineConfig({target: 'chrome90'})).target).toBe('chrome90')
    expect((await defineConfig({target: ['chrome90', 'safari16']})).target).toEqual([
      'chrome90',
      'safari16',
    ])
  })
})

describe('tsconfig option', () => {
  test('is undefined by default, so tsdown auto-detects it from the project', async () => {
    expect((await defineConfig()).tsconfig).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    expect((await defineConfig({tsconfig: 'tsconfig.dist.json'})).tsconfig).toBe(
      'tsconfig.dist.json',
    )
  })
})

describe('outDir option', () => {
  test('is undefined by default, so tsdown writes to dist', async () => {
    expect((await defineConfig()).outDir).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    expect((await defineConfig({outDir: 'lib'})).outDir).toBe('lib')
  })
})

describe('clean option', () => {
  test('is undefined by default, so tsdown cleans outDir before each build', async () => {
    expect((await defineConfig()).clean).toBeUndefined()
  })

  test('is passed through to tsdown as-is', async () => {
    expect((await defineConfig({clean: false})).clean).toBe(false)
    expect((await defineConfig({clean: true})).clean).toBe(true)
    // Prefer an array of folders over a package.json `"clean": "rimraf …"` script — include
    // outDir (`dist`) when you still want it cleaned alongside other directories
    expect((await defineConfig({clean: ['dist', 'coverage']})).clean).toEqual(['dist', 'coverage'])
  })
})

describe('css option', () => {
  test('is undefined by default', async () => {
    // tsdown's CSS pipeline stays off unless `@tsdown/css` is installed and `css` is set
    expect((await defineConfig()).css).toBeUndefined()
  })

  test('is forwarded to tsdown with the Sanity defaults applied', async () => {
    const config = await defineConfig({
      css: {modules: {localsConvention: 'camelCase' as const}},
    })

    expect(config.css).toEqual({
      // Published Sanity libraries ship minified CSS, like `vanillaExtract`
      minify: true,
      // `@tsdown/css`'s own injection emits a relative `import "./style.css"`, which throws in
      // runtimes that cannot load `.css` files - `cssNodeCompatPlugin` injects the
      // self-referential specifier of the conditional CSS export instead
      inject: false,
      // Browserless targets fall back to `@sanity/browserslist-config`, like `vanillaExtract`
      lightningcss: {targets: expect.any(Object)},
      modules: {localsConvention: 'camelCase'},
    })
    // `exports` is this config's own option, not a `@tsdown/css` one, so it is stripped
    expect(config.css).not.toHaveProperty('exports')
    expect(pluginNames(config)).toContain('sanity-css-node-compat')
  })

  test('respects an explicit `minify` and `target`', async () => {
    const config = await defineConfig({css: {minify: false, target: 'chrome61'}})

    expect(config.css).toMatchObject({minify: false, target: 'chrome61'})
    // A target that names browsers is lowered by `@tsdown/css` itself, so no fallback applies
    expect(config.css).not.toHaveProperty('lightningcss.targets')
  })

  test('can be enabled alongside vanillaExtract', async () => {
    // Both pipelines are independent: `vanillaExtract` extracts `.css.ts` into `bundle.css`,
    // `@tsdown/css` handles everything else. The fixture build covers them end-to-end.
    const config = await defineConfig({
      vanillaExtract: true,
      css: {modules: {localsConvention: 'camelCase'}},
    })

    expect(pluginNames(config)).toEqual(
      expect.arrayContaining(['vanilla-extract', 'sanity-css-node-compat']),
    )
  })

  test('writes the conditional CSS export unless `css.exports` is false', async () => {
    const withExports = await defineConfig({css: {}, exports: true})
    await runCssConfigHook(withExports)
    expect(withExports.exports).toHaveProperty('customExports')

    const withoutExports = await defineConfig({css: {exports: false}, exports: true})
    await runCssConfigHook(withoutExports)
    expect(withoutExports.exports).not.toHaveProperty('customExports')
  })
})

function pluginNames(config: UserConfig): string[] {
  const {plugins} = config
  if (!Array.isArray(plugins)) throw new Error('expected plugins array')
  return plugins.flatMap((plugin) =>
    plugin && typeof plugin === 'object' && 'name' in plugin && typeof plugin.name === 'string'
      ? [plugin.name]
      : [],
  )
}

/** Runs the node-compat plugin's `tsdownConfig` hook, like tsdown does when it resolves. */
async function runCssConfigHook(config: UserConfig): Promise<void> {
  const {plugins} = config
  if (!Array.isArray(plugins)) expect.unreachable('expected `plugins` to be an array')
  const plugin: TsdownPlugin | undefined = plugins.find(
    (candidate): candidate is TsdownPlugin =>
      !!candidate &&
      typeof candidate === 'object' &&
      'name' in candidate &&
      candidate.name === 'sanity-css-node-compat',
  )
  if (!plugin || typeof plugin.tsdownConfig !== 'function') {
    expect.unreachable('expected the node-compat plugin with a `tsdownConfig` hook')
  }
  expect(await plugin.tsdownConfig(config, {})).toBeUndefined() // mutates the config in place
}

describe('sourcemap option', () => {
  test('defaults to true, matching @sanity/pkg-utils', async () => {
    // tsdown itself defaults to false and does not read `sourceMap` from the tsconfig
    expect((await defineConfig()).sourcemap).toBe(true)
  })

  test('is passed through to tsdown as-is', async () => {
    expect((await defineConfig({sourcemap: false})).sourcemap).toBe(false)
    expect((await defineConfig({sourcemap: 'inline'})).sourcemap).toBe('inline')
  })
})

describe('deps option', () => {
  test('defaults to neverBundle `/^node:/` when platform is neutral', async () => {
    expect((await defineConfig()).deps).toEqual({neverBundle: [/^node:/]})
    expect((await defineConfig({platform: 'neutral'})).deps).toEqual({neverBundle: [/^node:/]})
  })

  test('does not add `/^node:/` when platform is not neutral', async () => {
    expect((await defineConfig({platform: 'node'})).deps).toBeUndefined()
    expect(
      (await defineConfig({platform: 'node', deps: {skipNodeModulesBundle: true}})).deps,
    ).toEqual({skipNodeModulesBundle: true})
  })

  test('appends userland neverBundle entries to the `/^node:/` default', async () => {
    // tsdown's `mergeConfig` would replace the array; concatenate so per-package externals
    // (e.g. self-references like `/^sanity(\\/|$)/`) add to the node builtins instead
    expect((await defineConfig({deps: {neverBundle: [/^sanity(\/|$)/]}})).deps).toEqual({
      neverBundle: [/^node:/, /^sanity(\/|$)/],
    })
    expect(
      (
        await defineConfig({
          deps: {neverBundle: [/^sanity(\/|$)/], skipNodeModulesBundle: true},
        })
      ).deps,
    ).toEqual({
      neverBundle: [/^node:/, /^sanity(\/|$)/],
      skipNodeModulesBundle: true,
    })
  })

  test('composes a userland neverBundle function with the `/^node:/` default', async () => {
    // Rolldown's ExternalOption array form is string|RegExp only, so a function override is
    // OR'd with the node builtin check instead of being pushed into an array
    const neverBundle = (
      await defineConfig({
        deps: {
          neverBundle: (id) => id === 'sanity/_singletons' || id.startsWith('sanity/'),
        },
      })
    ).deps?.neverBundle
    expect(typeof neverBundle).toBe('function')
    if (typeof neverBundle !== 'function') throw new Error('expected a function')

    expect(neverBundle('node:fs', undefined, false)).toBe(true)
    expect(neverBundle('sanity/_singletons', undefined, false)).toBe(true)
    expect(neverBundle('lodash', undefined, false)).toBe(false)
  })
})

describe('neutral platform resolution', () => {
  test('restores module/main mainFields for inlined deps without an exports map', async () => {
    const {inputOptions} = await defineConfig()
    expect(inputOptions && typeof inputOptions !== 'function' && inputOptions.resolve).toEqual({
      mainFields: ['module', 'main'],
    })
  })

  test('leaves mainFields alone when platform is not neutral', async () => {
    const {inputOptions} = await defineConfig({platform: 'node'})
    expect(
      inputOptions && typeof inputOptions !== 'function' ? inputOptions.resolve : undefined,
    ).toBeUndefined()
  })
})

describe('checks option', () => {
  test('enables Rolldown circularDependency warnings by default', async () => {
    // Rolldown itself defaults `checks.circularDependency` to `false`; this config opts in so
    // import cycles surface as build warnings. Override with mergeConfig if needed.
    // https://rolldown.rs/reference/InputOptions.checks#circulardependency
    expect((await defineConfig()).checks).toEqual({circularDependency: true})
  })
})

/** A `CIRCULAR_DEPENDENCY` warning as rolldown formats it: colored code prefix, trailing dot. */
function circularWarning(...modules: string[]): string {
  return `\u001B[33m[CIRCULAR_DEPENDENCY] \u001B[0mCircular dependency: ${modules.join(' -> ')}.\n`
}

async function resolveSuppressWarnings(
  options?: Parameters<typeof defineConfig>[0],
): Promise<(message: string) => boolean> {
  const {suppressWarnings} = await defineConfig(options)
  if (typeof suppressWarnings !== 'function') throw new Error('expected a predicate')
  return suppressWarnings
}

describe('suppressWarnings option', () => {
  test('drops circular dependency warnings whose whole cycle is declaration files', async () => {
    // The declaration bundling pass gets the same `checks.circularDependency`, but every import
    // between `.d.ts` modules is type-only and erased at runtime, so those cycles carry none of
    // the hazards the check exists to surface — and they're unavoidable for mutually
    // referencing public types (https://github.com/sanity-io/sanity/pull/13753)
    const isSuppressed = await resolveSuppressWarnings()

    expect(
      isSuppressed(circularWarning('src/index.d.ts', 'src/nodes.d.ts', 'src/index.d.ts')),
    ).toBe(true)
    expect(
      isSuppressed(circularWarning('src/index.d.mts', 'src/nodes.d.mts', 'src/index.d.mts')),
    ).toBe(true)
    expect(
      isSuppressed(circularWarning('src/index.d.cts', 'src/nodes.d.cts', 'src/index.d.cts')),
    ).toBe(true)
    // Longer cycles, and the colorless form of the message
    expect(isSuppressed(circularWarning('a.d.ts', 'b.d.ts', 'c.d.ts', 'd.d.ts', 'a.d.ts'))).toBe(
      true,
    )
    expect(
      isSuppressed('Circular dependency: src/index.d.ts -> src/nodes.d.ts -> src/index.d.ts.'),
    ).toBe(true)
  })

  test('keeps circular dependency warnings that involve a runtime module', async () => {
    const isSuppressed = await resolveSuppressWarnings()

    expect(isSuppressed(circularWarning('src/a.ts', 'src/b.ts', 'src/a.ts'))).toBe(false)
    // A single runtime module in the cycle is enough to keep the warning
    expect(isSuppressed(circularWarning('src/a.d.ts', 'src/b.ts', 'src/a.d.ts'))).toBe(false)
    expect(isSuppressed(circularWarning('src/a.js', 'src/b.d.ts', 'src/a.js'))).toBe(false)
    // `.d.ts.map` is a sourcemap, not a declaration module
    expect(
      isSuppressed(circularWarning('src/a.d.ts.map', 'src/b.d.ts.map', 'src/a.d.ts.map')),
    ).toBe(false)
  })

  test('keeps every other warning', async () => {
    const isSuppressed = await resolveSuppressWarnings()

    expect(isSuppressed('[UNRESOLVED_IMPORT] Could not resolve "./missing.d.ts"')).toBe(false)
    expect(isSuppressed('[MIXED_EXPORT] Mixing named and default exports in src/index.d.ts')).toBe(
      false,
    )
    expect(isSuppressed('')).toBe(false)
  })

  test('adds userland patterns to the built-in suppression instead of replacing it', async () => {
    // `mergeConfig` would replace the predicate (functions don't merge), which would silently
    // bring the declaration-only cycle warnings back
    const dtsCycle = circularWarning('src/index.d.ts', 'src/nodes.d.ts', 'src/index.d.ts')
    const runtimeCycle = circularWarning('src/a.ts', 'src/b.ts', 'src/a.ts')

    const withString = await resolveSuppressWarnings({suppressWarnings: 'src/a.ts'})
    expect(withString(dtsCycle)).toBe(true)
    expect(withString(runtimeCycle)).toBe(true)
    expect(withString(circularWarning('src/c.ts', 'src/d.ts', 'src/c.ts'))).toBe(false)

    const withRegExps = await resolveSuppressWarnings({
      suppressWarnings: [/UNRESOLVED_IMPORT/, 'EMPTY_BUNDLE'],
    })
    expect(withRegExps(dtsCycle)).toBe(true)
    expect(withRegExps('[UNRESOLVED_IMPORT] Could not resolve "foo"')).toBe(true)
    expect(withRegExps('[EMPTY_BUNDLE] Generated an empty chunk')).toBe(true)
    expect(withRegExps(runtimeCycle)).toBe(false)

    const withPredicate = await resolveSuppressWarnings({
      suppressWarnings: (message) => message.includes('EMPTY_BUNDLE'),
    })
    expect(withPredicate(dtsCycle)).toBe(true)
    expect(withPredicate('[EMPTY_BUNDLE] Generated an empty chunk')).toBe(true)
    expect(withPredicate(runtimeCycle)).toBe(false)
  })

  test('resets a stateful userland pattern, so it matches every message', async () => {
    // A `/g` (or `/y`) RegExp carries `lastIndex` between `test` calls and would skip messages
    const isSuppressed = await resolveSuppressWarnings({suppressWarnings: /EMPTY_BUNDLE/g})

    expect(isSuppressed('[EMPTY_BUNDLE] Generated an empty chunk for "a"')).toBe(true)
    expect(isSuppressed('[EMPTY_BUNDLE] Generated an empty chunk for "b"')).toBe(true)
  })

  test('leaves a non-stateful userland pattern untouched', async () => {
    // `test` ignores `lastIndex` unless the pattern is global or sticky, so writing to it would
    // be a no-op that only introduces a failure mode — a frozen RegExp would throw
    const isSuppressed = await resolveSuppressWarnings({
      suppressWarnings: Object.freeze(/EMPTY_BUNDLE/),
    })

    expect(isSuppressed('[EMPTY_BUNDLE] Generated an empty chunk')).toBe(true)
    expect(isSuppressed('[UNRESOLVED_IMPORT] Could not resolve "foo"')).toBe(false)
  })
})

describe('minify default', () => {
  test('compresses with keepNames, without mangling or codegen minification', async () => {
    // Consumers' production builds minify `node_modules` again anyway, so the dist only gets
    // the compress pass — with `keepNames`, since the inner name in patterns like
    // `forwardRef(function Button(…) {…})` is what React DevTools shows via `Function.name`
    // (the tree-shakeable alternative to top-level `displayName` assignments, see
    // https://github.com/sanity-io/ui/pull/2435). Names stripped at publish time are
    // unrecoverable in userland.
    expect((await defineConfig()).minify).toEqual({
      compress: {keepNames: {function: true, class: true}},
      codegen: false,
      mangle: false,
    })
  })
})

describe('unexposed options', () => {
  test('lean on tsdown defaults, customizable in userland through `mergeConfig`', async () => {
    // Options not in `PackageOptions` (e.g. `hash`, with its collision-preventing hashed chunk
    // filenames - https://github.com/sanity-io/ui/issues/2262 - or `outputOptions`) are left to
    // tsdown's defaults; userland can still change them by merging over the returned config
    // with tsdown's `mergeConfig`
    const config = await defineConfig()
    expect(config).not.toHaveProperty('hash')
    expect(config.outputOptions).toBeUndefined()
  })
})

describe('exports option', () => {
  test('defaults to always-on generation with dev exports', async () => {
    // `enabled: true` generates the `exports` map on every build (no `'local-only'`/
    // `'ci-only'` gate); `devExports: true` keeps the local `exports` map pointing at source
    // files while `publishConfig.exports` receives the built files
    expect((await defineConfig()).exports).toEqual({enabled: true, devExports: true})
  })

  test('merges an object over the defaults', async () => {
    expect((await defineConfig({exports: {all: true}})).exports).toEqual({
      enabled: true,
      devExports: true,
      all: true,
    })
    expect((await defineConfig({exports: {devExports: 'source'}})).exports).toEqual({
      enabled: true,
      devExports: 'source',
    })
  })

  test('non-object values replace the defaults, like `mergeConfig`', async () => {
    // A bare CI condition passes through as-is (dropping the defaults - set
    // `exports: {enabled: 'ci-only'}` to merge instead), and `false` disables the feature
    expect((await defineConfig({exports: 'ci-only'})).exports).toBe('ci-only')
    expect((await defineConfig({exports: {enabled: 'ci-only'}})).exports).toEqual({
      enabled: 'ci-only',
      devExports: true,
    })
    expect((await defineConfig({exports: false})).exports).toBe(false)
  })
})
