import {parseExports, type PackageJSON} from '@sanity/parse-package-json'
import {describe, expect, test} from 'vitest'

const name = 'test'
const version = '0.0.0-test'
const defaults = {
  '.': {
    source: './src/index.ts',
    import: './dist/index.mjs',
    require: './dist/index.cjs',
    default: './dist/index.js',
  },
} as const
const files = ['dist']

describe.each([{type: 'commonjs' as const}, {type: 'module' as const}, {type: undefined}])(
  'parseExports({type: $type})',
  ({type}) => {
    const testParseExports = (options: {pkg: PackageJSON}) => parseExports(options)
    const reference = {
      '.': {
        source: defaults['.'].source,
        import: defaults['.'][type === 'module' ? 'default' : 'import'],
        require: defaults['.'][type !== 'module' ? 'default' : 'require'],
        default: defaults['.'].default,
      },
      './package.json': './package.json',
    } as const

    describe('valid package.json examples', () => {
      test('parse basic package.json', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: reference['.'].require,
          types: './dist/index.d.ts',
          exports: reference,
        } satisfies PackageJSON

        const exports = testParseExports({pkg})

        expect(exports).toEqual([
          {
            _exported: true,
            _path: '.',
            ...reference['.'],
          },
        ])
      })

      test.skipIf(type === 'module')('parse minimal CJS package.json', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: './dist/index.js',
          types: './dist/index.d.ts',
          exports: {
            '.': {
              source: './src/index.ts',
              import: './dist/index.mjs',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
        } satisfies PackageJSON

        const exports = testParseExports({pkg})

        expect(exports).toEqual([
          {
            _exported: true,
            _path: '.',
            ...reference['.'],
          },
        ])
      })

      test.skipIf(type === 'module')('parse minimal CJS-only package.json', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: './dist/index.js',
          types: './dist/index.d.ts',
          exports: {
            '.': {
              source: './src/index.ts',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
        } satisfies PackageJSON

        const exports = testParseExports({pkg})

        expect(exports).toEqual([
          {
            _exported: true,
            _path: '.',
            source: './src/index.ts',
            require: './dist/index.js',
            default: './dist/index.js',
          },
        ])
      })

      test.skipIf(type !== 'module')('parse minimal ESM package.json', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: './dist/index.cjs',
          types: './dist/index.d.ts',
          exports: {
            '.': {
              source: './src/index.ts',
              require: './dist/index.cjs',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
        } satisfies PackageJSON

        const exports = testParseExports({pkg})

        expect(exports).toEqual([
          {
            _exported: true,
            _path: '.',
            ...reference['.'],
          },
        ])
      })

      test.skipIf(type !== 'module')('parse minimal ESM-only package.json', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: './dist/index.js',
          types: './dist/index.d.ts',
          exports: {
            '.': {
              source: './src/index.ts',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
        } satisfies PackageJSON

        const exports = testParseExports({pkg})

        expect(exports).toEqual([
          {
            _exported: true,
            _path: '.',
            source: './src/index.ts',
            import: './dist/index.js',
            default: './dist/index.js',
          },
        ])
      })
    })

    describe('invalid packages', () => {
      test('no "exports" returns an empty array', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: './dist/index.js',
          types: './dist/index.d.ts',
        } satisfies PackageJSON

        expect(testParseExports({pkg})).toEqual([])
      })
    })
  },
)
