import {expect, test} from 'vitest'
import {_BuildContext, _PackageJSON, _parseExports} from '../src'
import {_parseTasks} from '../src/build/_parseTasks'

test('should parse tasks', () => {
  const pkg: _PackageJSON = {
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
    extract: false,
    files: [],
    pkg,
    runtime: '*',
    src: 'src',
    target: {
      '*': ['chrome102', 'node14'],
      browser: ['chrome102'],
      node: ['node14'],
    },
  }

  const tasks = _parseTasks(ctx)

  // console.log(JSON.stringify(tasks, null, 2))

  expect(tasks).toEqual([
    {
      type: 'rollup',
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
      type: 'rollup',
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
      type: 'rollup',
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
      type: 'rollup',
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
