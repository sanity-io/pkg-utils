import {describe, expect, test} from 'vitest'
import {_PackageJSON, _parseExports} from '../src/node'

describe('_parseExports', () => {
  test('parse basic package.json', () => {
    const pkg: _PackageJSON = {
      name: 'test',
      version: '0.0.0-test',
      bin: {test: './dist/cli.cjs'},
      source: './src/index.ts',
      main: './src/index.cjs',
      exports: {
        '.': {
          source: './src/index.ts',
          require: './dist/index.cjs',
          default: './dist/index.cjs',
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
        require: './dist/index.cjs',
        default: './dist/index.cjs',
      },
    ])
  })
})
