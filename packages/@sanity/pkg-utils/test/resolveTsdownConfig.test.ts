import path from 'node:path'
import type {PackageJSON} from '@sanity/parse-package-json'
import {expect, test, vi} from 'vitest'
import type {PkgConfigOptions} from '../src/node/core/config/types'
import type {BuildContext} from '../src/node/core/contexts/buildContext'
import {parseAndValidateExports} from '../src/node/core/pkg/parseAndValidateExports'
import {createLogger} from '../src/node/logger'
import {parseStrictOptions} from '../src/node/strict'
import {resolveTsdownBuilds} from '../src/node/tasks/tsdown/resolveTsdownBuilds'
import {resolveTsdownConfig} from '../src/node/tasks/tsdown/resolveTsdownConfig'

const strictOptions = parseStrictOptions({})
const logger = createLogger()
// The package root, not `process.cwd()`: the root-level vitest run (CI) has a different
// working directory than a package-level run
const cwd = path.resolve(__dirname, '..')

function createContext(config: BuildContext['config']): BuildContext {
  const pkg: PackageJSON = {
    type: 'module',
    name: 'test',
    version: '1.0.0',
    types: './dist/index.d.ts',
    files: ['dist'],
    exports: {
      '.': {
        source: './src/index.ts',
        import: './dist/index.js',
        require: './dist/index.cjs',
        default: './dist/index.js',
      },
      './package.json': './package.json',
    },
  }

  const exports = parseAndValidateExports({
    cwd,
    pkg,
    strict: true,
    strictOptions,
    logger,
  })

  return {
    bundledPackages: [],
    config,
    cwd,
    deps: undefined,
    distPath: path.join(cwd, 'dist'),
    emitDeclarationOnly: false,
    cssExports: [],
    exports: Object.fromEntries(exports.map(({_path, ...entry}) => [_path, entry])),
    external: [],
    logger: {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    },
    pkg,
    runtime: '*',
    target: {
      '*': ['chrome102', 'node14'],
      'browser': ['chrome102'],
      'node': ['node14'],
    },
    strict: true,
    ts: {},
  }
}

test('a leftover v11 `dts` string degrades to the default instead of spreading', async () => {
  // With the `legacyChecks` migration errors skipped (`NODE_ENV=production` /
  // `legacyChecks: false`), a leftover `dts: 'rolldown'` string reaches the config resolver;
  // it meant "the default behavior" and must not object-spread into character keys
  const legacyConfig: PkgConfigOptions = JSON.parse('{"dts": "rolldown", "legacyChecks": false}')
  const ctx = createContext(legacyConfig)
  const [build] = resolveTsdownBuilds(ctx)
  if (!build) throw new Error('expected a build')

  const inlineConfig = await resolveTsdownConfig(ctx, build, {clean: false})

  expect(inlineConfig.dts).toEqual({newContext: true})
})

test('the `dts` object passthrough spreads over the defaults', async () => {
  const ctx = createContext({dts: {tsgo: true, sourcemap: true}})
  const [build] = resolveTsdownBuilds(ctx)
  if (!build) throw new Error('expected a build')

  const inlineConfig = await resolveTsdownConfig(ctx, build, {clean: false})

  expect(inlineConfig.dts).toEqual({newContext: true, tsgo: true, sourcemap: true})
})

test('forwards `bundleAnalyzer` to @sanity/tsdown-config', async () => {
  const disabled = createContext({})
  const [disabledBuild] = resolveTsdownBuilds(disabled)
  if (!disabledBuild) throw new Error('expected a build')
  const disabledConfig = await resolveTsdownConfig(disabled, disabledBuild, {clean: false})
  expect(pluginNames(disabledConfig)).not.toContain('builtin:bundle-analyzer')

  const enabled = createContext({bundleAnalyzer: true})
  const [enabledBuild] = resolveTsdownBuilds(enabled)
  if (!enabledBuild) throw new Error('expected a build')
  const enabledConfig = await resolveTsdownConfig(enabled, enabledBuild, {clean: false})
  expect(pluginNames(enabledConfig)).toContain('builtin:bundle-analyzer')
  expect(bundleAnalyzerOptions(enabledConfig)).toEqual({format: 'md'})

  const customized = createContext({
    bundleAnalyzer: {format: 'json', fileName: 'bundle-analysis.json'},
  })
  const [customizedBuild] = resolveTsdownBuilds(customized)
  if (!customizedBuild) throw new Error('expected a build')
  const customizedConfig = await resolveTsdownConfig(customized, customizedBuild, {clean: false})
  expect(bundleAnalyzerOptions(customizedConfig)).toEqual({
    format: 'json',
    fileName: 'bundle-analysis.json',
  })
})

function pluginNames(config: {plugins?: unknown}): string[] {
  const {plugins} = config
  if (!Array.isArray(plugins)) return []
  return plugins.flatMap((plugin) =>
    plugin && typeof plugin === 'object' && 'name' in plugin && typeof plugin.name === 'string'
      ? [plugin.name]
      : [],
  )
}

function bundleAnalyzerOptions(config: {plugins?: unknown}): unknown {
  const {plugins} = config
  if (!Array.isArray(plugins)) return undefined
  const plugin = plugins.find(
    (candidate) =>
      candidate &&
      typeof candidate === 'object' &&
      'name' in candidate &&
      candidate.name === 'builtin:bundle-analyzer',
  )
  return plugin && typeof plugin === 'object' && '_options' in plugin ? plugin._options : undefined
}

test('inherits the declaration-only circular dependency suppression', async () => {
  // `checks.circularDependency` comes from `@sanity/tsdown-config`, and so does the
  // `suppressWarnings` predicate that drops the type-only cycles of the declaration bundling
  // pass — the pkg-utils `mergeConfig` layer must not replace it
  const ctx = createContext({})
  const [build] = resolveTsdownBuilds(ctx)
  if (!build) throw new Error('expected a build')

  const {suppressWarnings} = await resolveTsdownConfig(ctx, build, {clean: false})
  if (typeof suppressWarnings !== 'function') throw new Error('expected a predicate')

  expect(
    suppressWarnings('Circular dependency: src/index.d.ts -> src/nodes.d.ts -> src/index.d.ts.'),
  ).toBe(true)
  expect(
    suppressWarnings('Circular dependency: src/index.ts -> src/nodes.ts -> src/index.ts.'),
  ).toBe(false)
})
