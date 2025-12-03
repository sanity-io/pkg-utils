import type {PackageJSON} from '@sanity/parse-package-json'
import {expect, test, vi} from 'vitest'
import type {BuildContext} from '../src/node/core/contexts/buildContext'
import {parseAndValidateExports} from '../src/node/core/pkg/parseExports'
import {createLogger} from '../src/node/logger'
import {resolveBuildTasks} from '../src/node/resolveBuildTasks'
import {parseStrictOptions} from '../src/node/strict'

const strictOptions = parseStrictOptions({})
const logger = createLogger()
const cwd = process.cwd()

test('should parse tasks (type: module)', () => {
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

  const exports = parseAndValidateExports({
    cwd,
    pkg,
    strict: true,
    strictOptions,
    logger,
  })

  const ctx: BuildContext = {
    bundledPackages: [],
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
    dts: 'api-extractor',
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
