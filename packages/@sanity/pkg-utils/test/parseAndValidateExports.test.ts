import type {PackageJSON} from '@sanity/parse-package-json'
import {describe, expect, test} from 'vitest'
import {parseAndValidateExports} from '../src/node/core/pkg/parseAndValidateExports'
import {createLogger} from '../src/node/logger'
import {parseStrictOptions} from '../src/node/strict'

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
const strictOptions = parseStrictOptions({})
const logger = createLogger()
const cwd = process.cwd()

describe.each([{type: 'commonjs' as const}, {type: 'module' as const}, {type: undefined}])(
  'parseAndValidateExports({type: $type})',
  ({type}) => {
    const testParseExports = (
      options: Omit<
        Parameters<typeof parseAndValidateExports>[0],
        'strict' | 'strictOptions' | 'logger' | 'cwd'
      >,
    ) => parseAndValidateExports({strict: true, logger, strictOptions, cwd, ...options})
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
      describe('the "exports" key is required', () => {
        test('uses the "browsers" field to specify a "browser" condition', () => {
          const pkg = {
            type,
            name,
            version,
            files,
            source: './src/index.ts',
            main: './lib/index.js',
            module: './lib/index.esm.js',
            types: './lib/index.d.ts',
            browser: (type === 'module'
              ? {
                  './lib/index.cjs': './lib/browser.cjs',
                  './lib/index.js': './lib/browser.js',
                }
              : type === 'commonjs'
                ? {
                    './lib/index.mjs': './lib/browser.mjs',
                    './lib/index.js': './lib/browser.js',
                  }
                : {
                    './lib/index.js': './lib/browser.js',
                  }) as Record<string, string>,
          } satisfies PackageJSON

          expect(() => testParseExports({pkg})).toThrowError(/`exports` are missing/)
          expect(() => testParseExports({pkg})).toThrowError(/"browser"/)
          expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
        })

        test('maps "source" to "browsers" field to specify a "browser" condition', () => {
          const pkg = {
            type,
            name,
            version,
            files,
            source: './src/index.ts',
            main: './lib/index.js',
            module: './lib/index.esm.js',
            types: './lib/index.d.ts',
            browser: (type === 'module'
              ? {
                  './src/index.ts': './src/browser.ts',
                  './lib/index.cjs': './lib/browser.cjs',
                  './lib/index.js': './lib/browser.js',
                }
              : type === 'commonjs'
                ? {
                    './src/index.ts': './src/browser.ts',
                    './lib/index.mjs': './lib/browser.mjs',
                    './lib/index.js': './lib/browser.js',
                  }
                : {
                    './src/index.ts': './src/browser.ts',
                    './lib/index.js': './lib/browser.js',
                  }) as Record<string, string>,
          } satisfies PackageJSON

          expect(() => testParseExports({pkg})).toThrowError(/`exports` are missing/)
          expect(() => testParseExports({pkg})).toThrowError(/"browser"/)
          expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
        })

        test('uses the "main" and "source" fields to specify a suggested "exports" definition', () => {
          const pkg = {
            type,
            name,
            version,
            files,
            source: './src/index.ts',
            main: './lib/index.js',
            types: './dist/index.d.ts',
          } satisfies PackageJSON

          expect(() => testParseExports({pkg})).toThrowError(/`exports` are missing/)
          expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
        })

        test.skip('shows a best effort message if there is no "main" field', () => {
          const pkg = {
            type,
            name,
            version,
            files,
            source: './src/index.ts',
            types: './dist/index.d.ts',
          } satisfies PackageJSON

          expect(() => testParseExports({pkg})).toThrowError(/`exports` are missing/)
          expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
        })

        test('shows a best effort message if there is no "source" field either', () => {
          const pkg = {
            type,
            name,
            version,
            files,
            main: './dist/index.js',
            types: './dist/index.d.ts',
          } satisfies PackageJSON

          expect(() => testParseExports({pkg})).toThrowError(/`exports` are missing/)
          expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
        })
      })

      test('the "source" field should be removed when "exports" is set', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          source: './src/index.ts',
          main: './lib/index.js',
          types: './lib/index.d.ts',
          exports: {
            '.': {
              source: './src/index.ts',
              default: './lib/index.js',
            },
            './package.json': './package.json',
          },
        } satisfies PackageJSON

        expect(() => testParseExports({pkg})).toThrowError(/the "source" property can be removed/)
        expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
      })

      test('css exports must be strings (paths)', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: './lib/index.js',
          types: './lib/index.d.ts',
          exports: {
            '.': {
              source: './src/index.ts',
              default: './lib/index.js',
            },
            './style.css': {source: './src/style.css', default: './lib/style.css'},
            './package.json': './package.json',
          },
        } satisfies PackageJSON

        expect(() => testParseExports({pkg})).toThrowError(
          'package.json: `exports["./style.css"]`: export conditions not supported for CSS files.',
        )
      })

      test('css exports must exist on file system', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: './lib/index.js',
          types: './lib/index.d.ts',
          exports: {
            '.': {
              source: './src/index.ts',
              default: './lib/index.js',
            },
            './style.css': './src/style.css',
            './package.json': './package.json',
          },
        } satisfies PackageJSON

        expect(() => testParseExports({pkg})).toThrowError(
          'package.json: `exports["./style.css"]`: file does not exist.',
        )
      })

      test('the "package.json" field should be set to "./package.json" (if set)', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: './lib/index.js',
          types: './lib/index.d.ts',
          exports: {
            '.': {
              source: './src/index.ts',
              default: './lib/index.js',
            },
            './package.json': './other.json',
          },
        } satisfies PackageJSON

        expect(() => testParseExports({pkg})).toThrowError(
          'package.json: `exports["./package.json"]` must be "./package.json"',
        )
      })
    })
  },
)
