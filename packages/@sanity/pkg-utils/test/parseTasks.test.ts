import type {PackageJSON} from '@sanity/parse-package-json'
import {expect, test, vi} from 'vitest'
import type {BuildContext} from '../src/node/core/contexts/buildContext'
import {parseAndValidateExports} from '../src/node/core/pkg/parseAndValidateExports'
import {createLogger} from '../src/node/logger'
import {parseStrictOptions} from '../src/node/strict'
import {resolveTsdownBuilds} from '../src/node/tasks/tsdown/resolveTsdownBuilds'

const strictOptions = parseStrictOptions({})
const logger = createLogger()
const cwd = process.cwd()

function createContext(pkg: PackageJSON, config?: BuildContext['config']): BuildContext {
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
    cwd: '/test',
    deps: undefined,
    distPath: '/test/dist',
    emitDeclarationOnly: false,
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
    runtime: config?.runtime ?? '*',
    target: {
      '*': ['chrome102', 'node14'],
      'browser': ['chrome102'],
      'node': ['node14'],
    },
    strict: true,
    ts: {},
  }
}

test('should resolve builds (type: module)', () => {
  const pkg: PackageJSON = {
    type: 'module',
    name: 'test',
    version: '1.0.0',
    main: './dist/index.cjs',
    module: './dist/index.js',
    types: './dist/index.d.ts',
    browser: {
      './dist/index.cjs': './dist/index.browser.cjs',
      './dist/index.js': './dist/index.browser.js',
    },
    files: ['dist'],
    exports: {
      '.': {
        source: './src/index.ts',
        browser: {
          source: './src/index.ts',
          import: './dist/index.browser.js',
          require: './dist/index.browser.cjs',
        },
        import: './dist/index.js',
        require: './dist/index.cjs',
        default: './dist/index.js',
      },
      './package.json': './package.json',
    },
  }

  const ctx = createContext(pkg)
  const builds = resolveTsdownBuilds(ctx)

  // Variants first, the canonical (exports-owning) build last
  expect(builds).toEqual([
    {
      key: 'browser',
      runtime: 'browser',
      canonical: false,
      entries: [
        {
          alias: 'index.browser',
          source: './src/index.ts',
          exportPath: '.',
          formats: ['esm', 'commonjs'],
        },
      ],
    },
    {
      key: 'canonical',
      runtime: '*',
      canonical: true,
      entries: [
        {
          alias: 'index',
          source: './src/index.ts',
          exportPath: '.',
          formats: ['esm', 'commonjs'],
        },
      ],
    },
  ])

  // Scheduling a runtime-conditioned variant build warns about the pattern
  expect(ctx.logger.warn).toHaveBeenCalledTimes(1)
})

test('should resolve builds (type: commonjs)', () => {
  const pkg: PackageJSON = {
    type: 'commonjs',
    name: 'test',
    version: '1.0.0',
    main: './dist/index.js',
    module: './dist/index.mjs',
    types: './dist/index.d.ts',
    files: ['dist'],
    exports: {
      '.': {
        source: './src/index.ts',
        import: './dist/index.mjs',
        require: './dist/index.js',
        default: './dist/index.js',
      },
      './extra': {
        source: './src/extra.ts',
        import: './dist/extra.mjs',
        require: './dist/extra.js',
        default: './dist/extra.js',
      },
      './package.json': './package.json',
    },
  }

  const ctx = createContext(pkg)
  const builds = resolveTsdownBuilds(ctx)

  expect(builds).toEqual([
    {
      key: 'canonical',
      runtime: '*',
      canonical: true,
      entries: [
        {
          alias: 'index',
          source: './src/index.ts',
          exportPath: '.',
          formats: ['esm', 'commonjs'],
        },
        {
          alias: 'extra',
          source: './src/extra.ts',
          exportPath: './extra',
          formats: ['esm', 'commonjs'],
        },
      ],
    },
  ])

  expect(ctx.logger.warn).not.toHaveBeenCalled()
})

test('should resolve `bundles` into their own build', () => {
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
        default: './dist/index.js',
      },
      './package.json': './package.json',
    },
  }

  const ctx = createContext(pkg, {
    bundles: [
      {source: './src/cli.ts', import: './dist/cli.js'},
      {source: './src/worker.ts', import: './dist/worker.js', runtime: 'node'},
    ],
  })
  const builds = resolveTsdownBuilds(ctx)

  expect(builds).toEqual([
    {
      key: 'bundles',
      runtime: '*',
      canonical: false,
      entries: [{alias: 'cli', source: './src/cli.ts', formats: ['esm']}],
    },
    {
      key: 'bundles:node',
      runtime: 'node',
      canonical: false,
      entries: [{alias: 'worker', source: './src/worker.ts', formats: ['esm']}],
    },
    {
      key: 'canonical',
      runtime: '*',
      canonical: true,
      entries: [
        {
          alias: 'index',
          source: './src/index.ts',
          exportPath: '.',
          formats: ['esm'],
        },
      ],
    },
  ])
})

test('should keep the `*` runtime of a bundle in a non-`*` runtime package', () => {
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
        default: './dist/index.js',
      },
      './package.json': './package.json',
    },
  }

  // A `runtime: '*'` bundle in a `runtime: 'node'` package must build for `'*'` (the neutral
  // platform), not inherit the package runtime
  const ctx = createContext(pkg, {
    runtime: 'node',
    bundles: [{source: './src/browser-safe.ts', import: './dist/browser-safe.js', runtime: '*'}],
  })
  const builds = resolveTsdownBuilds(ctx)

  expect(builds).toEqual([
    {
      key: 'bundles:*',
      runtime: '*',
      canonical: false,
      entries: [{alias: 'browser-safe', source: './src/browser-safe.ts', formats: ['esm']}],
    },
    {
      key: 'canonical',
      runtime: 'node',
      canonical: true,
      entries: [
        {
          alias: 'index',
          source: './src/index.ts',
          exportPath: '.',
          formats: ['esm'],
        },
      ],
    },
  ])
})
