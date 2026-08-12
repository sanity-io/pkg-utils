import {_typoMap, parsePackage, ZodError, type PackageJSON} from '@sanity/parse-package-json'
import {describe, expect, test} from 'vitest'

function issuesOf(input: unknown) {
  try {
    parsePackage(input)
  } catch (err) {
    if (err instanceof ZodError) return err.issues
    throw err
  }
  return []
}

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

  test('preserves defaults inside nested runtime conditions', () => {
    const pkg = {
      ...template,
      exports: {
        ...template.exports,
        '.': {
          ...template.exports['.'],
          browser: {
            source: './src/index.browser.ts',
            import: './dist/index.browser.js',
            default: './dist/index.browser-fallback.js',
          },
          node: {
            source: './src/index.node.ts',
            import: './dist/index.node.js',
            default: './dist/index.node-fallback.js',
          },
          default: './dist/index.js',
        },
      },
    }

    expect(parsePackage(pkg).exports?.['.']).toMatchObject({
      browser: {default: './dist/index.browser-fallback.js'},
      node: {default: './dist/index.node-fallback.js'},
    })
  })

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
          types: './dist/bundle-css.d.ts',
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
      types: './dist/bundle-css.d.ts',
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

  test('passes a `svelte` entry through untouched', () => {
    const pkg = {
      ...template,
      exports: {
        ...template.exports,
        './Component.svelte': {
          types: './dist/Component.svelte.d.ts',
          svelte: './dist/Component.svelte',
          default: './dist/Component.js',
        },
      },
    }

    const parsed = parsePackage(pkg)

    expect(parsed.exports?.['./Component.svelte']).toEqual({
      types: './dist/Component.svelte.d.ts',
      svelte: './dist/Component.svelte',
      default: './dist/Component.js',
    })
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

  describe('conditional CSS exports are only expected on `.css` subpaths', () => {
    test('reports the offending condition for a non-`.css` subpath, not a missing `.css` file', () => {
      // A `node` condition in `exports` must be an object: the build derives the node variant of
      // the entry from its `source`. The error must point at the condition that is wrong.
      const issues = issuesOf({
        ...template,
        exports: {
          ...template.exports,
          '.': {
            source: './src/index.ts',
            node: './dist/index.node.js',
            default: './dist/index.js',
          },
        },
      })

      expect(issues).toEqual([
        expect.objectContaining({
          code: 'invalid_type',
          expected: 'object',
          received: 'string',
          path: ['exports', '.', 'node'],
        }),
      ])
    })

    test('still requires a `.css` target on a conditional `.css` export', () => {
      const issues = issuesOf({
        ...template,
        exports: {
          ...template.exports,
          './bundle.css': {node: './dist/bundle-css.js', default: './dist/bundle-css.js'},
        },
      })

      expect(issues).toEqual([
        expect.objectContaining({
          message: expect.stringContaining('".css" file'),
          path: ['exports', './bundle.css'],
        }),
      ])
    })
  })

  describe('publishConfig.exports', () => {
    test('accepts a runtime condition condensed to a string', () => {
      // `"node": "./dist/index.node.js"` is what is left of `{source, default}` once the `source`
      // condition is stripped for publishing - the resolver treats it as `{default: <path>}`.
      const pkg = {
        ...template,
        exports: {
          ...template.exports,
          '.': {
            'source': './src/index.ts',
            'react-server': './dist/index.js',
            'node': {source: './src/index.node.ts', default: './dist/index.node.js'},
            'default': './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              'react-server': './dist/index.js',
              'node': './dist/index.node.js',
              'default': './dist/index.js',
            },
            './package.json': './package.json',
          },
        },
      }

      expect(() => parsePackage(pkg)).not.toThrow()
    })
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
