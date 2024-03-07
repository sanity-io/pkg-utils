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

  describe('allows a wide variety of conditional exports', () => {
    test.each([
      [
        {
          require: './dist/index.cjs',
          default: './dist/index.js',
        },
        `"import" isn't required when "default" is present`,
      ],
      [
        {
          import: './dist/index.js',
          default: './dist/index.cjs',
        },
        `"require" isn't required when "default" is present`,
      ],
      [
        {
          browser: {
            types: './dist/index.browser.d.ts',
            source: './src/index.browser.ts',
            import: './dist/index.js',
            require: './dist/index.cjs',
          },
          import: './dist/index.js',
          require: './dist/index.cjs',
        },
        `"browser" can output both a "import" and "require" condition`,
      ],
      [
        {
          require: './dist/index.cjs',
          browser: {
            types: './dist/index.browser.d.ts',
            source: './src/index.browser.ts',
            import: './dist/index.js',
          },
          import: './dist/index.js',
        },
        `"browser" can optionally override just "import"`,
      ],
      [
        {
          node: {
            source: './src/index.node.ts',
            import: './dist/index.node.js',
            require: './dist/index.node.cjs',
          },
          import: './dist/index.js',
          require: './dist/index.cjs',
        },
        `"node" can output both a "import" and "require" condition`,
      ],
    ])('%o', (json, msg) => {
      const extMap = getPkgExtMap({legacyExports: false})

      const pkg = {
        type: 'module',
        name: 'test',
        version: '0.0.0-test',
        exports: {
          '.': {
            types: './dist/index.d.ts',
            source: './src/index.ts',
            ...json,
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
      } satisfies PackageJSON

      expect(() => parseExports({extMap, pkg, strict: true}), msg).not.toThrow()
    })
  })

  describe.todo('enforces best practices', () => {
    test.each([
      [
        {
          default: './dist/index.js',
        },
        `"source" is required`,
      ],
      [
        {
          source: './src/index.ts',
        },
        `"default" is required`,
      ],
      [
        {
          source: './src/index.ts',
          types: './dist/index.d.ts',
          require: './dist/index.cjs',
          default: './dist/index.js',
        },
        `"types" should be first`,
      ],
      [
        {
          source: './src/index.ts',
          default: './dist/index.js',
          require: './dist/index.cjs',
        },
        `"default" should be last`,
      ],
      [
        {
          types: './dist/index.d.ts',
          require: './dist/index.cjs',
          source: './src/index.ts',
          default: './dist/index.js',
        },
        `"source" should be after "types"`,
      ],
      [
        {
          source: './src/index.ts',
          require: './dist/index.cjs',
          import: './dist/index.js',
          node: {
            module: './dist/index.js',
          },
          default: './dist/index.js',
        },
        `"node.module" considered harmful`,
      ],
      [
        {
          source: './src/index.ts',
          module: './dist/index.js',
          require: './dist/index.cjs',
          import: './dist/index.js',
          default: './dist/index.js',
        },
        `"module" considered harmful`,
      ],
      [
        {
          source: './src/index.ts',
          require: './dist/index.cjs',
          import: './dist/index.js',
          node: {
            import: './dist/index.node.js',
          },
          default: './dist/index.js',
        },
        `"node.import" must be before "import"`,
      ],
      [
        {
          source: './src/index.ts',
          node: {
            import: './dist/index.node.js',
            require: './dist/index.cjs',
          },
          import: './dist/index.js',
          require: './dist/index.cjs',
          default: './dist/index.js',
        },
        `"node.require" is unnecesary if it's the same as "require"`,
      ],
      [
        {
          require: './dist/index.cjs',
          node: {
            import: './dist/index.cjs.js',
          },
          import: './dist/index.js',
        },
        `the "node" re-export pattern considered harmful, protect against the "dual package hazard" in ways that have high ecosystem compatibility`,
      ],
      [
        {
          source: './src/index.ts',
          require: './dist/index.cjs',
          node: {
            import: './node/index.js',
            require: './node/index.cjs',
          },
          import: './dist/index.js',
          default: './dist/index.js',
        },
        `"node.require" must be before "require"`,
      ],
      [
        {
          source: './src/index.ts',
          import: './dist/index.js',
          node: {
            import: './node/index.js',
            require: './node/index.cjs',
          },
          require: './dist/index.cjs',
          default: './dist/index.js',
        },
        `"node.import" must be before "import"`,
      ],
    ])('%o throws because %s', (json, msg) => {
      const extMap = getPkgExtMap({legacyExports: false})

      const pkg = {
        type: 'module',
        name: 'test',
        version: '0.0.0-test',
        exports: {
          // @ts-expect-error -- a lot of the examples are intentionally invalid
          '.': json,
          './package.json': './package.json',
        },
      } satisfies PackageJSON

      // @ts-expect-error -- a lot of the examples are intentionally invalid
      expect(() => parseExports({extMap, pkg, strict: true}), msg).toThrowErrorMatchingSnapshot()
    })
  })
})
