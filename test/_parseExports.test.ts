import {describe, expect, test} from 'vitest'
import {_PackageJSON, _parseExports} from '../src/node'

describe('_parseExports', () => {
  test('parse basic package.json', () => {
    const pkg: _PackageJSON = {
      type: 'commonjs',
      name: 'test',
      version: '0.0.0-test',
      bin: {test: './dist/cli.js'},
      source: './src/index.ts',
      main: './dist/index.js',
      exports: {
        '.': {
          source: './src/index.ts',
          require: './dist/index.js',
          default: './dist/index.js',
        },
      },
    }

    const exports = _parseExports({pkg})

    expect(exports).toEqual([
      {
        _exported: true,
        _path: '.',
        types: undefined,
        source: './src/index.ts',
        browser: undefined,
        import: undefined,
        require: './dist/index.js',
        default: './dist/index.js',
      },
    ])
  })

  test('parse package.json with browser files', () => {
    const pkg: _PackageJSON = {
      type: 'module',
      name: 'test',
      version: '0.0.0-test',
      exports: {
        '.': {
          types: './dist/types/src/index.d.ts',
          browser: {
            source: './src/index.ts',
            require: './dist/index.cjs',
            import: './dist/index.js',
          },
          source: './src/index.ts',
          require: './dist/index.cjs',
          import: './dist/index.js',
          default: './dist/index.js',
        },
      },
    }

    const exports = _parseExports({pkg})

    expect(exports).toEqual([
      {
        _exported: true,
        _path: '.',
        types: './dist/types/src/index.d.ts',
        source: './src/index.ts',
        browser: {
          source: './src/index.ts',
          require: './dist/index.cjs',
          import: './dist/index.js',
        },
        import: './dist/index.js',
        require: './dist/index.cjs',
        default: './dist/index.js',
      },
    ])
  })
})
