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

test('keeps single-format shapes, remaps aliased subpaths, and preserves plain-string publish entries', () => {
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

  // Publish: a plain-string entry without hand-written conditions to re-insert stays a string
  const publish = composer(
    {
      '.': './dist/index.js',
      './sub/feature': './dist/sub/feature.js',
      './package.json': './package.json',
    },
    {isPublish: true},
  )

  expect(publish).toEqual({
    '.': './dist/index.js',
    './feature': './dist/sub/feature.js',
    './package.json': './package.json',
  })
})
