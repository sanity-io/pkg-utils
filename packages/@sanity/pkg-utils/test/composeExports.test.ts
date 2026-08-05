import path from 'node:path'
import type {PackageJSON} from '@sanity/parse-package-json'
import {expect, test, vi} from 'vitest'
import type {BuildContext} from '../src/node/core/contexts/buildContext'
import {parseAndValidateExports} from '../src/node/core/pkg/parseAndValidateExports'
import {createLogger} from '../src/node/logger'
import {parseStrictOptions} from '../src/node/strict'
import {createExportsComposer} from '../src/node/tasks/tsdown/composeExports'
import {resolveTsdownBuilds} from '../src/node/tasks/tsdown/resolveTsdownBuilds'

const strictOptions = parseStrictOptions({})
const logger = createLogger()
// The package root, not `process.cwd()`: the exports validation resolves file-existence
// checks (the `./styles.css` fixture) against this, and the root-level vitest run (CI) has a
// different working directory than a package-level run
const cwd = path.resolve(__dirname, '..')

function createComposer(pkg: PackageJSON) {
  const exports = parseAndValidateExports({
    cwd,
    pkg,
    strict: true,
    strictOptions,
    logger,
  })

  const ctx: BuildContext = {
    bundledPackages: [],
    config: undefined,
    cwd: '/test',
    deps: undefined,
    distPath: '/test/dist',
    emitDeclarationOnly: false,
    exports: Object.fromEntries(exports.map(({_path, ...entry}) => [_path, entry])),
    external: [],
    logger: {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    },
    pkg,
    runtime: '*',
    target: {
      '*': ['chrome102', 'node14'],
      'browser': ['chrome102'],
      'node': ['node14'],
    },
    strict: true,
    ts: {},
  }

  const builds = resolveTsdownBuilds(ctx)
  const canonical = builds.at(-1)
  if (!canonical?.canonical) throw new Error('expected a canonical build')
  return createExportsComposer(ctx, canonical)
}

test('reconciles the generated map with hand-written conditions (dev and publish)', () => {
  const composer = createComposer({
    type: 'module',
    name: 'test',
    version: '1.0.0',
    types: './dist/index.d.ts',
    files: ['dist'],
    exports: {
      '.': {
        source: './src/index.ts',
        types: './dist/index.d.ts',
        browser: {
          source: './src/index.browser.ts',
          import: './dist/index.browser.js',
          require: './dist/index.browser.cjs',
        },
        node: {
          import: './dist/index.node.js',
          require: './dist/index.node.cjs',
        },
        import: './dist/index.js',
        require: './dist/index.cjs',
        default: './dist/index.js',
      },
      './styles.css': './test/env/fixture.css',
      './package.json': './package.json',
    },
  })

  // The dev shape tsdown generates with `devExports: 'source'` for a dual-format entry
  const dev = composer(
    {
      '.': {source: './src/index.ts', import: './dist/index.js', require: './dist/index.cjs'},
      './package.json': './package.json',
    },
    {isPublish: false},
  )

  expect(dev).toEqual({
    '.': {
      source: './src/index.ts',
      types: './dist/index.d.ts',
      browser: {
        source: './src/index.browser.ts',
        import: './dist/index.browser.js',
        require: './dist/index.browser.cjs',
      },
      node: {
        import: './dist/index.node.js',
        require: './dist/index.node.cjs',
      },
      import: './dist/index.js',
      require: './dist/index.cjs',
      // tsdown emits bare `import`/`require` pairs; the convention ends with `default`
      default: './dist/index.js',
    },
    // hand-written non-JS subpaths pass through untouched
    './styles.css': './test/env/fixture.css',
    './package.json': './package.json',
  })
  // key order follows the hand-written map
  expect(Object.keys(dev)).toEqual(['.', './styles.css', './package.json'])

  // The publish shape (no `source` conditions anywhere)
  const publish = composer(
    {
      '.': {import: './dist/index.js', require: './dist/index.cjs'},
      './package.json': './package.json',
    },
    {isPublish: true},
  )

  expect(publish).toEqual({
    '.': {
      types: './dist/index.d.ts',
      browser: {
        import: './dist/index.browser.js',
        require: './dist/index.browser.cjs',
      },
      node: {
        import: './dist/index.node.js',
        require: './dist/index.node.cjs',
      },
      import: './dist/index.js',
      require: './dist/index.cjs',
      default: './dist/index.js',
    },
    './styles.css': './test/env/fixture.css',
    './package.json': './package.json',
  })
})

test('carries hand-written custom conditions over, before the format fallbacks', () => {
  const composer = createComposer({
    type: 'module',
    name: 'test',
    version: '1.0.0',
    types: './dist/index.d.ts',
    files: ['dist'],
    // Custom conditions aren't part of the `PkgExports` typings, but hand-written
    // `package.json` data is untyped JSON — the parser spreads them through
    exports: {
      '.': {
        'source': './src/index.ts',
        'types': './dist/index.d.ts',
        'react-server': './dist/index.react-server.js',
        'import': './dist/index.js',
        'require': './dist/index.cjs',
        'default': './dist/index.js',
      },
      './worker': {
        source: './src/worker.ts',
        worker: {import: './dist/worker.worker.js'},
        default: './dist/worker.js',
      },
      './package.json': './package.json',
    } as PackageJSON['exports'],
  })

  const dev = composer(
    {
      '.': {source: './src/index.ts', import: './dist/index.js', require: './dist/index.cjs'},
      './worker': {source: './src/worker.ts', default: './dist/worker.js'},
      './package.json': './package.json',
    },
    {isPublish: false},
  )

  expect(dev).toEqual({
    '.': {
      'source': './src/index.ts',
      'types': './dist/index.d.ts',
      'react-server': './dist/index.react-server.js',
      'import': './dist/index.js',
      'require': './dist/index.cjs',
      'default': './dist/index.js',
    },
    './worker': {
      source: './src/worker.ts',
      worker: {import: './dist/worker.worker.js'},
      default: './dist/worker.js',
    },
    './package.json': './package.json',
  })
  // custom conditions must precede the `import`/`require`/`default` fallbacks to ever match
  expect(Object.keys(dev['.'] as Record<string, unknown>)).toEqual([
    'source',
    'types',
    'react-server',
    'import',
    'require',
    'default',
  ])

  const publish = composer(
    {
      '.': {import: './dist/index.js', require: './dist/index.cjs'},
      // a plain-string publish entry must expand when custom conditions have to be re-inserted
      './worker': './dist/worker.js',
      './package.json': './package.json',
    },
    {isPublish: true},
  )

  expect(publish).toEqual({
    '.': {
      'types': './dist/index.d.ts',
      'react-server': './dist/index.react-server.js',
      'import': './dist/index.js',
      'require': './dist/index.cjs',
      'default': './dist/index.js',
    },
    './worker': {
      worker: {import: './dist/worker.worker.js'},
      default: './dist/worker.js',
    },
    './package.json': './package.json',
  })
  expect(Object.keys(publish['./worker'] as Record<string, unknown>)).toEqual(['worker', 'default'])
})

test('preserves independent authored orders around browser and custom conditions', () => {
  const composer = createComposer({
    type: 'module',
    name: 'test',
    version: '1.0.0',
    types: './dist/index.d.ts',
    files: ['dist'],
    exports: {
      '.': {
        'source': './src/index.ts',
        'deno': './dist/index.js',
        'edge': './dist/index.js',
        'edge-light': './dist/index.js',
        'worker': './dist/index.js',
        'react-server': './dist/index.react-server.js',
        'browser': {
          source: './src/index.browser.ts',
          require: './dist/index.browser.cjs',
          import: './dist/index.browser.js',
        },
        'import': './dist/index.js',
        'require': './dist/index.cjs',
        'default': './dist/index.js',
      },
      './package.json': './package.json',
    } as PackageJSON['exports'],
    publishConfig: {
      exports: {
        '.': {
          'worker': './dist/index.js',
          'deno': './dist/index.js',
          'edge': './dist/index.js',
          'edge-light': './dist/index.js',
          'react-server': './dist/index.react-server.js',
          'browser': {
            import: './dist/index.browser.js',
            require: './dist/index.browser.cjs',
          },
          'require': './dist/index.cjs',
          'import': './dist/index.js',
          'default': './dist/index.js',
        },
        './package.json': './package.json',
      },
    } as PackageJSON['publishConfig'],
  })

  const dev = composer(
    {
      '.': {source: './src/index.ts', import: './dist/index.js', require: './dist/index.cjs'},
      './package.json': './package.json',
    },
    {isPublish: false},
  )
  const devEntry = dev['.'] as Record<string, unknown>

  expect(Object.keys(devEntry)).toEqual([
    'source',
    'deno',
    'edge',
    'edge-light',
    'worker',
    'react-server',
    'browser',
    'import',
    'require',
    'default',
  ])
  expect(Object.keys(devEntry['browser'] as Record<string, unknown>)).toEqual([
    'source',
    'require',
    'import',
  ])

  const publish = composer(
    {
      '.': {import: './dist/index.js', require: './dist/index.cjs'},
      './package.json': './package.json',
    },
    {isPublish: true},
  )
  const publishEntry = publish['.'] as Record<string, unknown>

  expect(Object.keys(publishEntry)).toEqual([
    'worker',
    'deno',
    'edge',
    'edge-light',
    'react-server',
    'browser',
    'require',
    'import',
    'default',
  ])
  expect(Object.keys(publishEntry['browser'] as Record<string, unknown>)).toEqual([
    'import',
    'require',
  ])
})

test('inserts generated conditions before the authored default fallback', () => {
  const composer = createComposer({
    type: 'module',
    name: 'test',
    version: '1.0.0',
    types: './dist/index.d.ts',
    files: ['dist'],
    exports: {
      '.': {
        source: './src/index.ts',
        import: './dist/index.js',
        default: './dist/index.js',
      },
      './package.json': './package.json',
    },
    publishConfig: {
      exports: {
        '.': {
          import: './dist/index.js',
          default: './dist/index.js',
        },
        './package.json': './package.json',
      },
    },
  })

  // A mixed-format build can generate a format that this particular entry did not declare.
  // It has no authored position, so it belongs immediately before the `default` fallback.
  const dev = composer(
    {
      '.': {source: './src/index.ts', import: './dist/index.js', require: './dist/index.cjs'},
      './package.json': './package.json',
    },
    {isPublish: false},
  )
  expect(Object.keys(dev['.'] as Record<string, unknown>)).toEqual([
    'source',
    'import',
    'require',
    'default',
  ])

  const publish = composer(
    {
      '.': {import: './dist/index.js', require: './dist/index.cjs'},
      './package.json': './package.json',
    },
    {isPublish: true},
  )
  expect(Object.keys(publish['.'] as Record<string, unknown>)).toEqual([
    'import',
    'require',
    'default',
  ])
})

test('keeps single-format shapes, remaps aliases, and materializes publish conditions', () => {
  const composer = createComposer({
    type: 'module',
    name: 'test',
    version: '1.0.0',
    types: './dist/index.d.ts',
    files: ['dist'],
    exports: {
      '.': {
        source: './src/index.ts',
        default: './dist/index.js',
      },
      // The subpath name does not match the output basename: entry alias is `sub/feature`,
      // so tsdown generates `./sub/feature` and the composer must map it back
      './feature': {
        source: './src/feature.ts',
        default: './dist/sub/feature.js',
      },
      './package.json': './package.json',
    },
  })

  // Dev: single-format entries keep tsdown's `{source, default}` shape
  const dev = composer(
    {
      '.': {source: './src/index.ts', default: './dist/index.js'},
      './sub/feature': {source: './src/feature.ts', default: './dist/sub/feature.js'},
      './package.json': './package.json',
    },
    {isPublish: false},
  )

  expect(dev).toEqual({
    '.': {source: './src/index.ts', default: './dist/index.js'},
    './feature': {source: './src/feature.ts', default: './dist/sub/feature.js'},
    './package.json': './package.json',
  })
  expect(Object.keys(dev)).toEqual(['.', './feature', './package.json'])

  // Publish: tsdown's plain-string single-format entries become explicit `default` conditions,
  // matching the generated condition in `exports` and making it available for user reordering.
  const publish = composer(
    {
      '.': './dist/index.js',
      './sub/feature': './dist/sub/feature.js',
      './package.json': './package.json',
    },
    {isPublish: true},
  )

  expect(publish).toEqual({
    '.': {default: './dist/index.js'},
    './feature': {default: './dist/sub/feature.js'},
    './package.json': './package.json',
  })
})
