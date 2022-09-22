import {expect, test, vi} from 'vitest'
import {_BuildContext, _PackageJSON, _parseExports, _resolveBuildTasks} from '../src/node'

test('should parse tasks', () => {
  const pkg: _PackageJSON = {
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

  const exports = _parseExports({pkg})

  const ctx: _BuildContext = {
    cwd: '/test',
    dist: 'dist',
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
    src: 'src',
    target: {
      '*': ['chrome102', 'node14'],
      browser: ['chrome102'],
      node: ['node14'],
    },
    ts: {},
  }

  const tasks = _resolveBuildTasks(ctx)

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
