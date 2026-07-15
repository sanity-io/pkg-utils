import {_typoMap, parsePackage, type PackageJSON} from '@sanity/parse-package-json'
import {describe, expect, test} from 'vitest'

describe('parsePackage', () => {
  const template = {
    name: 'dummy-module',
    version: '0.0.0',
    license: 'MIT',
    type: 'module',
    exports: {
      '.': {
        source: './src/index.ts',
        require: './dist/index.cjs',
        import: './dist/index.js',
      },
      './package.json': './package.json',
    },
  }

  test.each([
    [
      {type: 'module'},
      {
        exports: {
          '.': {
            default: './dist/index.js',
          },
        },
      },
    ],
    [
      {type: undefined},
      {
        type: 'commonjs',
        exports: {
          '.': {
            default: './dist/index.cjs',
          },
        },
      },
    ],
    [
      {type: 'commonjs'},
      {
        type: 'commonjs',
        exports: {
          '.': {
            default: './dist/index.cjs',
          },
        },
      },
    ],
    [
      {
        type: 'commonjs',
        exports: {
          // @ts-expect-error - this is a test
          '.': {
            source: './src/index.ts',
            require: './dist/index.js',
            import: './dist/index.mjs',
          },
        },
      },
      {
        exports: {
          '.': {
            import: './dist/index.mjs',
            default: './dist/index.js',
          },
        },
      },
    ],
    [
      {
        type: 'module',
        exports: {
          // @ts-expect-error - this is a test
          '.': {
            source: './src/index.ts',
            development: './src/index.ts',
            require: './dist/index.cjs',
            import: './dist/index.js',
          },
        },
      },
      {
        exports: {
          '.': {
            development: './src/index.ts',
            import: './dist/index.js',
            default: './dist/index.js',
          },
        },
      },
    ],
    [
      {
        type: 'module',
        exports: {
          // @ts-expect-error - this is a test
          '.': {
            source: './src/index.ts',
            monorepo: './src/index.ts',
            require: './dist/index.cjs',
            import: './dist/index.js',
          },
        },
      },
      {
        exports: {
          '.': {
            monorepo: './src/index.ts',
            import: './dist/index.js',
            default: './dist/index.js',
          },
        },
      },
    ],
    [
      {
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            monorepo: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': './dist/index.js',
          },
        },
      },
      {
        exports: {
          '.': {
            monorepo: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': './dist/index.js',
          },
        },
      },
    ],
    [
      {
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            development: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': './dist/index.js',
          },
        },
      },
      {
        exports: {
          '.': {
            development: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': './dist/index.js',
          },
        },
      },
    ],
    [
      {
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            development: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          access: 'public' as const,
          registry: 'https://registry.npmjs.org',
          tag: 'latest',
          exports: {
            '.': './dist/index.js',
          },
        },
      },
      {
        exports: {
          '.': {
            development: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          access: 'public' as const,
          registry: 'https://registry.npmjs.org',
          tag: 'latest',
          exports: {
            '.': './dist/index.js',
          },
        },
      },
    ],
  ] as const satisfies [actual: Partial<PackageJSON>, expected: Partial<PackageJSON>][])(
    '%o => %o',
    (actual, expected) => {
      const pkg = {
        ...template,
        ...actual,
        exports: 'exports' in actual ? {...template.exports, ...actual.exports} : template.exports,
      }
      const parsed = parsePackage(pkg)
      expect(parsed).toMatchObject(expected)
      expect(parsed).toMatchSnapshot()
    },
  )

  test.each([
    // @ts-expect-error - this is a test
    {type: 'esm'},
    {
      exports: {
        '.': {
          // @ts-expect-error - this is a test
          Source: './src/index.ts',
          module: './dist/index.js',
        },
      },
    },
    {
      exports: {
        // @ts-expect-error - this is a test
        '.': {
          source: './src/index.ts',
        },
      },
    },
  ] as const satisfies Partial<PackageJSON>[])('%o throws an error', (actual) => {
    const pkg = {
      ...template,
      ...actual,
      exports: 'exports' in actual ? {...template.exports, ...actual.exports} : template.exports,
    }

    expect(() => parsePackage(pkg)).toThrowErrorMatchingSnapshot()
  })

  test('allows conditional CSS exports and passes them through untouched', () => {
    const pkg = {
      ...template,
      exports: {
        ...template.exports,
        './bundle.css': {
          browser: './dist/bundle.css',
          style: './dist/bundle.css',
          node: './dist/bundle-css.js',
          default: './dist/bundle-css.js',
        },
      },
    }

    const parsed = parsePackage(pkg)

    // The conditional CSS export must NOT have a `default` computed/added or be otherwise rewritten.
    expect(parsed.exports?.['./bundle.css']).toEqual({
      browser: './dist/bundle.css',
      style: './dist/bundle.css',
      node: './dist/bundle-css.js',
      default: './dist/bundle-css.js',
    })
  })

  test('still allows plain string CSS exports', () => {
    const pkg = {
      ...template,
      exports: {
        ...template.exports,
        './styles.css': './dist/styles.css',
      },
    }

    const parsed = parsePackage(pkg)

    expect(parsed.exports?.['./styles.css']).toBe('./dist/styles.css')
  })

  test('rejects a conditional object export with no `.css` target that is otherwise malformed', () => {
    const pkg = {
      ...template,
      exports: {
        ...template.exports,
        // Not a valid export entry (no default/import/require) and not a CSS conditions map.
        './broken': {foo: './dist/foo.js'},
      },
    }

    expect(() => parsePackage(pkg)).toThrow()
  })
})

test('typoMap lists all known keys', () => {
  expect(_typoMap).toMatchInlineSnapshot(`
    Map {
      "TYPE" => "type",
      "NAME" => "name",
      "VERSION" => "version",
      "LICENSE" => "license",
      "BIN" => "bin",
      "DEPENDENCIES" => "dependencies",
      "DEVDEPENDENCIES" => "devDependencies",
      "PEERDEPENDENCIES" => "peerDependencies",
      "SOURCE" => "source",
      "MAIN" => "main",
      "BROWSER" => "browser",
      "MODULE" => "module",
      "TYPES" => "types",
      "EXPORTS" => "exports",
      "PUBLISHCONFIG" => "publishConfig",
      "BROWSERSLIST" => "browserslist",
      "SIDEEFFECTS" => "sideEffects",
      "TYPESVERSIONS" => "typesVersions",
    }
  `)
})
