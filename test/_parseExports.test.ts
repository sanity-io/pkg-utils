import {describe, expect, test} from 'vitest'
import {_PackageJSON, _parseExports} from '../src'

describe('_parseExports', () => {
  test('parse basic package.json', () => {
    const pkg: _PackageJSON = {
      name: 'test',
      version: '0.0.0-test',
      bin: {
        test: './dist/cli.cjs',
      },
      exports: {
        '.': {
          source: './src/index.ts',
          require: './dist/index.cjs',
        },
      },
    }

    const exports = _parseExports(pkg)

    expect(exports).toEqual([
      {
        path: '.',
        runtime: 'web',

        default: undefined,
        source: './src/index.ts',
        require: './dist/index.cjs',
        types: undefined,
      },
    ])
  })
})
