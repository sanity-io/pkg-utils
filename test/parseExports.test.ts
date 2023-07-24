import {describe, expect, test} from 'vitest'

import {getPkgExtMap, PackageJSON, parseExports} from '../src/node'

describe('parseExports', () => {
  test('parse basic package.json', () => {
    const extMap = getPkgExtMap({legacyExports: false})

    const pkg: PackageJSON = {
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
        './package.json': './package.json',
      },
    }

    const exports = parseExports({pkg, extMap, strict: true})

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

  test('should throw if `package.json` is missing from the exports', () => {
    const extMap = getPkgExtMap({legacyExports: false})

    const pkg: PackageJSON = {
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

    expect(() => parseExports({extMap, pkg, strict: true})).toThrow(
      '\n- package.json: `exports["./package.json"] must be declared.',
    )
  })

  test('parse package.json with browser files', () => {
    const extMap = getPkgExtMap({legacyExports: false})

    const pkg: PackageJSON = {
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
        './package.json': './package.json',
      },
    }

    const exports = parseExports({extMap, pkg, strict: true})

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

  test('package.json with multiple exports errors', () => {
    const extMap = getPkgExtMap({legacyExports: false})

    const pkg: PackageJSON = {
      type: 'commonjs',
      name: 'test',
      version: '0.0.0-test',
      source: './src/index.ts',
      exports: {
        '.': {
          types: './lib/src/index.d.ts',
          source: './src/index.ts',
          import: './lib/index.wrong.suffix',
          require: './lib/index.wrong.suffix',
          default: './lib/index.js',
        },
        './package.json': './not/package.json',
      },
      main: './lib/index.js',
      module: './lib/index.mjs',
      types: './lib/src/index.d.ts',
    }

    expect(() => parseExports({extMap, pkg, strict: true})).toThrow(
      '\n- package.json: mismatch between "main" and "exports.require". These must be equal.' +
        '\n- package.json: mismatch between "module" and "exports.import" These must be equal.' +
        '\n- package.json: `exports["./package.json"] must be "./package.json".' +
        '\n- package.json with `type: "commonjs"` - `exports["."].require` must end with ".js"' +
        '\n- package.json with `type: "commonjs"` - `exports["."].import` must end with ".mjs"',
    )
  })
})
