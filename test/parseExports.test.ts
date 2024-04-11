import {describe, expect, test} from 'vitest'

import {createLogger, type PackageJSON, parseExports} from '../src/node'
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

describe.each([
  {type: 'commonjs' as const, legacyExports: false},
  {type: 'module' as const, legacyExports: false},
  {type: undefined, legacyExports: false},
  {type: 'commonjs' as const, legacyExports: true},
  {type: 'module' as const, legacyExports: true},
  {type: undefined, legacyExports: true},
])('parseExports({type: $type, legacyExports: $legacyExports})', ({type, legacyExports}) => {
  const testParseExports = (
    options: Omit<
      Parameters<typeof parseExports>[0],
      'strict' | 'strictOptions' | 'legacyExports' | 'logger'
    >,
  ) => parseExports({strict: true, legacyExports, logger, strictOptions, ...options})
  const reference = {
    '.': {
      source: defaults['.'].source,
      import: defaults['.'][type === 'module' ? 'default' : 'import'],
      require: defaults['.'][type !== 'module' ? 'default' : 'require'],
      default: defaults['.'].default,
    },
    './package.json': './package.json',
  } as const

  describe.skipIf(legacyExports)('valid package.json examples', () => {
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

  describe.runIf(legacyExports)('valid package.json examples when legacyExports is used', () => {
    test('parse basic package.json', () => {
      const pkg = {
        type,
        name,
        version,
        files,
        main: reference['.'].require,
        module: './dist/index.esm.js',
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
        module: './dist/index.esm.js',
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
        module: './dist/index.esm.js',
        types: './dist/index.d.ts',
        exports: {
          '.': {
            source: './src/index.ts',
            require: './dist/index.js',
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
        module: './dist/index.esm.js',
        types: './dist/index.d.ts',
        exports: {
          '.': {
            source: './src/index.ts',
            require: './dist/index.cjs',
            import: './dist/index.js',
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
        module: './dist/index.esm.js',
        types: './dist/index.d.ts',
        exports: {
          '.': {
            source: './src/index.ts',
            import: './dist/index.js',
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

    describe.runIf(legacyExports)('legacyExports: true', () => {
      test('it handles "browsers" if it only redirects "source"', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          source: './src/index.ts',
          main: './lib/index.js',
          module: './lib/index.esm.js',
          types: './lib/index.d.ts',
          browser: {
            './src/index.ts': './src/browser.ts',
          } as Record<string, string>,
        } satisfies PackageJSON

        expect(() => testParseExports({pkg})).toThrowError(/`exports` are missing/)
        expect(() => testParseExports({pkg})).toThrowError(/"browser"/)
        expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
      })

      test('gracefully falls back if the browsers field is invalid', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          source: './src/index.ts',
          main: './lib/index.js',
          module: './lib/index.esm.js',
          types: './lib/index.d.ts',
          browser: {} as Record<string, string>,
        } satisfies PackageJSON

        expect(() => testParseExports({pkg})).toThrowError(/`exports` are missing/)
        expect(() => testParseExports({pkg})).toThrowError(/"browser"/)
        expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
      })

      test('the top level "module" must end with `.esm.js`', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: reference['.'].require,
          module: reference['.'].import,
          types: './dist/index.d.ts',
          exports: reference,
        } satisfies PackageJSON

        expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
      })

      test('the top level "module" condition is required when legacyExports: true', () => {
        const pkg = {
          type,
          name,
          version,
          files,
          main: reference['.'].require,
          types: './dist/index.d.ts',
          exports: reference,
        } satisfies PackageJSON

        expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
      })

      test.runIf(type !== 'module')(
        'minimal CJS package.json requires a default condition when legacyExports: true',
        () => {
          const pkg = {
            type,
            name,
            version,
            files,
            main: './dist/index.js',
            types: './dist/index.d.ts',
            exports: {
              // @ts-expect-error - Testing invalid input
              '.': {
                source: './src/index.ts',
                import: './dist/index.mjs',
                require: './dist/index.js',
              },
              './package.json': './package.json',
            },
          } satisfies PackageJSON

          expect(() =>
            // @ts-expect-error - Testing invalid input
            testParseExports({pkg}),
          ).toThrowErrorMatchingSnapshot()
        },
      )

      test.runIf(type !== 'module')(
        'minimal CJS-only package.json requires a default condition when legacyExports: true',
        () => {
          const pkg = {
            type,
            name,
            version,
            files,
            main: './dist/index.js',
            types: './dist/index.d.ts',
            exports: {
              // @ts-expect-error - Testing invalid input
              '.': {
                source: './src/index.ts',
                require: './dist/index.js',
              },
              './package.json': './package.json',
            },
          } satisfies PackageJSON

          // @ts-expect-error - Testing invalid input
          expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
        },
      )

      test.runIf(type === 'module')(
        'minimal ESM package.json requires a default condition when legacyExports: true',
        () => {
          const pkg = {
            type,
            name,
            version,
            files,
            main: './dist/index.cjs',
            module: './dist/index.esm.js',
            types: './dist/index.d.ts',
            exports: {
              // @ts-expect-error - Testing invalid input
              '.': {
                source: './src/index.ts',
                import: './dist/index.js',
                require: './dist/index.cjs',
              },
              './package.json': './package.json',
            },
          } satisfies PackageJSON

          expect(() =>
            // @ts-expect-error - Testing invalid input
            testParseExports({pkg}),
          ).toThrowErrorMatchingSnapshot()
        },
      )

      test.runIf(type === 'module')(
        'minimal ESM-only package.json requires a default condition when legacyExports: true',
        () => {
          const pkg = {
            type,
            name,
            version,
            files,
            main: './dist/index.js',
            module: './dist/index.esm.js',
            types: './dist/index.d.ts',
            exports: {
              // @ts-expect-error - Testing invalid input
              '.': {
                source: './src/index.ts',
                import: './dist/index.js',
              },
              './package.json': './package.json',
            },
          } satisfies PackageJSON

          // @ts-expect-error - Testing invalid input
          expect(() => testParseExports({pkg, legacyExports})).toThrowErrorMatchingSnapshot()
        },
      )

      test.skipIf(type === 'module')(
        '.mjs file endings are mandatory when "type" is "commonjs"',
        () => {
          const pkg = {
            type,
            name,
            version,
            files,
            main: defaults['.'].default,
            module: './dist/index.esm.js',
            types: './dist/index.d.ts',
            exports: {
              '.': {
                source: defaults['.'].source,
                import: defaults['.'].default,
                require: defaults['.'].default,
                default: defaults['.'].import,
              },
              './package.json': './package.json',
            },
          } satisfies PackageJSON

          expect(() => testParseExports({pkg})).toThrowError(/must end with ".mjs"/)
          expect(() => testParseExports({pkg})).not.toThrowError(/mismatch/)
          expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
        },
      )

      test.runIf(type === 'module')(
        '.cjs file endings are mandatory when "type" is "module"',
        () => {
          const pkg = {
            type,
            name,
            version,
            files,
            main: defaults['.'].default,
            module: './dist/index.esm.js',
            types: './dist/index.d.ts',
            exports: {
              '.': {
                source: defaults['.'].source,
                import: defaults['.'].default,
                require: defaults['.'].default,
                default: defaults['.'].default,
              },
              './package.json': './package.json',
            },
          } satisfies PackageJSON

          expect(() => testParseExports({pkg})).toThrowError(/must end with ".cjs"/)
          expect(() => testParseExports({pkg})).not.toThrowError(/mismatch/)
          expect(() => testParseExports({pkg})).toThrowErrorMatchingSnapshot()
        },
      )

      test.todo('ensure the "browsers" field is correct when used')
      test.todo('require the "browsers" field is used when browser export conditions exists')
    })

    describe.skipIf(legacyExports)('legacyExports: false', () => {
      test.todo('the top level "module" field should be removed')
      test.todo('the top level "browser" field should be moved into "browser" export conditions')
    })
  })
})
