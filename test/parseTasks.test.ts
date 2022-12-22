import {expect, test, vi} from 'vitest'
import {BuildContext, getPkgExtMap, PackageJSON, parseExports, resolveBuildTasks} from '../src/node'

test('should parse tasks (type: module)', () => {
  const extMap = getPkgExtMap({legacyExports: false})

  const pkg: PackageJSON = {
    type: 'module',
    name: 'test',
    version: '1.0.0',
    source: './src/index.ts',
    main: './dist/index.cjs',
    module: './dist/index.js',
    browser: {
      './dist/index.cjs': './dist/index.browser.cjs',
      './dist/index.js': './dist/index.browser.js',
    },
  }

  const exports = parseExports({extMap, pkg, strict: true})

  const ctx: BuildContext = {
    cwd: '/test',
    distPath: '/test/dist',
    emitDeclarationOnly: false,
    exports: Object.fromEntries(exports.map(({_path, ...entry}) => [_path, entry])),
    extMap,
    external: [],
    files: [],
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
      browser: ['chrome102'],
      node: ['node14'],
    },
    strict: true,
    ts: {},
  }

  const tasks = resolveBuildTasks(ctx)

  expect(tasks).toEqual([
    {
      type: 'build:js',
      buildId: 'commonjs:*',
      entries: [
        {
          path: '.',
          source: './src/index.ts',
          output: './dist/index.cjs',
        },
      ],
      runtime: '*',
      format: 'commonjs',
      target: ['chrome102', 'node14'],
    },
    {
      type: 'build:js',
      buildId: 'esm:*',
      entries: [
        {
          path: '.',
          source: './src/index.ts',
          output: './dist/index.js',
        },
      ],
      runtime: '*',
      format: 'esm',
      target: ['chrome102', 'node14'],
    },
    {
      type: 'build:js',
      buildId: 'commonjs:browser',
      entries: [
        {
          path: '.',
          source: './src/index.ts',
          output: './dist/index.browser.cjs',
        },
      ],
      runtime: 'browser',
      format: 'commonjs',
      target: ['chrome102'],
    },
    {
      type: 'build:js',
      buildId: 'esm:browser',
      entries: [
        {
          path: '.',
          source: './src/index.ts',
          output: './dist/index.browser.js',
        },
      ],
      runtime: 'browser',
      format: 'esm',
      target: ['chrome102'],
    },
  ])
})

test('should parse tasks (type: commonjs, legacyExports: true)', () => {
  const extMap = getPkgExtMap({legacyExports: true})

  const pkg: PackageJSON = {
    type: 'commonjs',
    name: 'test',
    version: '1.0.0',
    source: './src/index.ts',
    main: './dist/index.js',
    module: './dist/index.esm.js',
    browser: {
      './dist/index.js': './dist/index.browser.js',
      './dist/index.esm.js': './dist/index.browser.esm.js',
    },
  }

  const exports = parseExports({extMap, pkg, strict: true})

  const ctx: BuildContext = {
    cwd: '/test',
    distPath: '/test/dist',
    emitDeclarationOnly: false,
    exports: Object.fromEntries(exports.map(({_path, ...entry}) => [_path, entry])),
    extMap,
    external: [],
    files: [],
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
      browser: ['chrome102'],
      node: ['node14'],
    },
    strict: true,
    ts: {},
  }

  const tasks = resolveBuildTasks(ctx)

  expect(tasks).toEqual([
    {
      type: 'build:js',
      buildId: 'commonjs:*',
      entries: [
        {
          path: '.',
          source: './src/index.ts',
          output: './dist/index.js',
        },
      ],
      runtime: '*',
      format: 'commonjs',
      target: ['chrome102', 'node14'],
    },
    {
      type: 'build:js',
      buildId: 'esm:*',
      entries: [
        {
          path: '.',
          source: './src/index.ts',
          output: './dist/index.esm.js',
        },
      ],
      runtime: '*',
      format: 'esm',
      target: ['chrome102', 'node14'],
    },
    {
      type: 'build:js',
      buildId: 'commonjs:browser',
      entries: [
        {
          path: '.',
          source: './src/index.ts',
          output: './dist/index.browser.js',
        },
      ],
      runtime: 'browser',
      format: 'commonjs',
      target: ['chrome102'],
    },
    {
      type: 'build:js',
      buildId: 'esm:browser',
      entries: [
        {
          path: '.',
          source: './src/index.ts',
          output: './dist/index.browser.esm.js',
        },
      ],
      runtime: 'browser',
      format: 'esm',
      target: ['chrome102'],
    },
  ])
})
