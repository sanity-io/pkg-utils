import {expect, test, vi} from 'vitest'

import {type BuildContext, type PackageJSON, parseExports, resolveBuildTasks} from '../src/node'

test('should parse tasks (type: module)', () => {
  const pkg: PackageJSON = {
    type: 'module',
    name: 'test',
    version: '1.0.0',
    source: './src/index.ts',
    main: './dist/index.cjs',
    module: './dist/index.js',
    types: './dist/index.d.ts',
    browser: {
      './dist/index.cjs': './dist/index.browser.cjs',
      './dist/index.js': './dist/index.browser.js',
    },
  }

  const exports = parseExports({pkg, strict: true, legacyExports: false})

  const ctx: BuildContext = {
    cwd: '/test',
    distPath: '/test/dist',
    emitDeclarationOnly: false,
    exports: Object.fromEntries(exports.map(({_path, ...entry}) => [_path, entry])),
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
      'browser': ['chrome102'],
      'node': ['node14'],
    },
    strict: true,
    ts: {},
  }

  const tasks = resolveBuildTasks(ctx)

  expect(tasks).toEqual([
    {
      entries: [
        {
          exportPath: '.',
          importId: 'test',
          sourcePath: './src/index.ts',
          targetPaths: ['./dist/index.d.ts', './dist/index.d.cts'],
        },
        {
          exportPath: '.',
          importId: 'test',
          sourcePath: './src/index.ts',
          targetPaths: ['./dist/index.browser.d.ts', './dist/index.browser.d.cts'],
        },
      ],
      type: 'build:dts',
    },
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
  const pkg: PackageJSON = {
    type: 'commonjs',
    name: 'test',
    version: '1.0.0',
    source: './src/index.ts',
    main: './dist/index.js',
    module: './dist/index.mjs',
    types: './dist/index.d.ts',
    browser: {
      './dist/index.js': './dist/index.browser.js',
      './dist/index.mjs': './dist/index.browser.mjs',
    },
  }

  const exports = parseExports({pkg, strict: true, legacyExports: true})

  const ctx: BuildContext = {
    cwd: '/test',
    distPath: '/test/dist',
    emitDeclarationOnly: false,
    exports: Object.fromEntries(exports.map(({_path, ...entry}) => [_path, entry])),
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
      'browser': ['chrome102'],
      'node': ['node14'],
    },
    strict: true,
    ts: {},
  }

  const tasks = resolveBuildTasks(ctx)

  expect(tasks).toEqual([
    {
      type: 'build:dts',
      entries: [
        {
          exportPath: '.',
          importId: 'test',
          sourcePath: './src/index.ts',
          targetPaths: ['./dist/index.d.mts', './dist/index.d.ts'],
        },
        {
          exportPath: '.',
          importId: 'test',
          sourcePath: './src/index.ts',
          targetPaths: ['./dist/index.browser.d.mts', './dist/index.browser.d.ts'],
        },
      ],
    },
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
          output: './dist/index.mjs',
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
          output: './dist/index.browser.mjs',
        },
      ],
      runtime: 'browser',
      format: 'esm',
      target: ['chrome102'],
    },
  ])
})
