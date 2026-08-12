import {mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe, expect, test} from 'vitest'
import {loadPkgWithReporting} from '../src/node/core/pkg/loadPkgWithReporting'
import {createLogger} from '../src/node/logger'
import {parseStrictOptions} from '../src/node/strict'

describe('publishConfig.exports validation', () => {
  const testDir = join(tmpdir(), 'pkg-utils-test-publishconfig')

  async function testPackage(
    pkg: any,
    shouldFail: boolean,
    // Optional hook to mutate the package on disk after it is written but before validation, e.g. to
    // run `writeBundleCssExports` (which is what a real build does between load and check).
    beforeValidate?: (cwd: string) => Promise<void>,
  ) {
    const testPath = join(testDir, Math.random().toString(36).substring(7))
    mkdirSync(testPath, {recursive: true})
    const pkgPath = join(testPath, 'package.json')
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

    if (beforeValidate) {
      await beforeValidate(testPath)
    }

    const logger = createLogger(true)

    let exitCalled = false
    const originalExit = process.exit
    const originalConsoleError = console.error
    const originalConsoleLog = console.log

    // Mock process.exit to prevent test from exiting
    process.exit = (() => {
      exitCalled = true
      throw new Error('process.exit called')
    }) as any

    // Suppress console output when we expect failure (to keep test output clean)
    if (shouldFail) {
      console.error = () => {}
      console.log = () => {}
    }

    try {
      await loadPkgWithReporting({
        pkgPath,
        logger,
        strict: true,
        strictOptions: parseStrictOptions({}),
      })

      if (shouldFail) {
        throw new Error('Expected validation to fail but it passed')
      }
    } catch (err: any) {
      if (!shouldFail && err.message !== 'process.exit called') {
        throw err
      }
      if (shouldFail && !exitCalled) {
        throw err
      }
    } finally {
      process.exit = originalExit
      console.error = originalConsoleError
      console.log = originalConsoleLog
      rmSync(testPath, {recursive: true, force: true})
    }

    if (shouldFail) {
      expect(exitCalled).toBe(true)
    } else {
      expect(exitCalled).toBe(false)
    }
  }

  test('should fail when publishConfig.exports default value differs from exports default', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              default: './dist/index.mjs',
            },
          },
        },
        files: ['dist'],
      },
      true,
    )
  })

  test('should fail when publishConfig.exports string value differs from exports default', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': './dist/index.mjs',
          },
        },
        files: ['dist'],
      },
      true,
    )
  })

  test('should fail when publishConfig.exports require differs from exports require (type: module)', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            require: './dist/index.cjs',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              require: './dist/index.js',
              default: './dist/index.mjs',
            },
          },
        },
        files: ['dist'],
      },
      true,
    )
  })

  test('should fail when publishConfig.exports import differs from exports import (type: commonjs)', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'commonjs',
        exports: {
          '.': {
            source: './src/index.ts',
            import: './dist/index.mjs',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              import: './dist/index.js',
              default: './dist/index.cjs',
            },
          },
        },
        files: ['dist'],
      },
      true,
    )
  })

  test('should pass when publishConfig.exports matches exports (excluding source)', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            require: './dist/index.cjs',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              require: './dist/index.cjs',
              default: './dist/index.js',
            },
          },
        },
        files: ['dist'],
      },
      false,
    )
  })

  test('should pass when publishConfig.exports string matches exports default', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': './dist/index.js',
          },
        },
        files: ['dist'],
      },
      false,
    )
  })

  test('should pass with a matching conditional CSS export in publishConfig.exports', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            default: './dist/index.js',
          },
          './bundle.css': {
            types: './dist/bundle-css.d.ts',
            browser: './dist/bundle.css',
            style: './dist/bundle.css',
            node: './dist/bundle-css.js',
            default: './dist/bundle-css.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              default: './dist/index.js',
            },
            './bundle.css': {
              types: './dist/bundle-css.d.ts',
              browser: './dist/bundle.css',
              style: './dist/bundle.css',
              node: './dist/bundle-css.js',
              default: './dist/bundle-css.js',
            },
          },
        },
        files: ['dist'],
      },
      false,
    )
  })

  test('should fail when publishConfig.exports conditional CSS export differs from exports', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            default: './dist/index.js',
          },
          './bundle.css': {
            types: './dist/bundle-css.d.ts',
            browser: './dist/bundle.css',
            style: './dist/bundle.css',
            node: './dist/bundle-css.js',
            default: './dist/bundle-css.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              default: './dist/index.js',
            },
            './bundle.css': {
              browser: './dist/bundle.css',
              style: './dist/bundle.css',
              node: './dist/bundle-css.js',
              // mismatched: points back at the real CSS instead of the shim
              default: './dist/bundle.css',
            },
          },
        },
        files: ['dist'],
      },
      true,
    )
  })

  test('should pass when a nested runtime condition is condensed to a string', async () => {
    // `"node": "./dist/index.node.js"` is all that is left of `{source, default}` once the
    // `source` condition is stripped for publishing, and resolves identically to
    // `{"default": "./dist/index.node.js"}` - the same condensation the entry itself allows.
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            node: {
              source: './src/index.node.ts',
              default: './dist/index.node.js',
            },
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              node: './dist/index.node.js',
              default: './dist/index.js',
            },
          },
        },
        files: ['dist'],
      },
      false,
    )
  })

  test('should fail when a condensed nested runtime condition points at the wrong file', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            node: {
              source: './src/index.node.ts',
              default: './dist/index.node.js',
            },
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              node: './dist/index.js',
              default: './dist/index.js',
            },
          },
        },
        files: ['dist'],
      },
      true,
    )
  })

  test('should fail when a nested runtime condition is condensed but has more than `default`', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            node: {
              source: './src/index.node.ts',
              require: './dist/index.node.cjs',
              default: './dist/index.node.js',
            },
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              node: './dist/index.node.js',
              default: './dist/index.js',
            },
          },
        },
        files: ['dist'],
      },
      true,
    )
  })

  test('should pass when a `.css` subpath declares only its `source`', async () => {
    // The documented way to ship a stylesheet: the author writes the `source` and the build
    // fills the remaining conditions into both maps. Before that first build `exports` holds
    // nothing but the `source` and `publishConfig.exports` holds nothing at all, so the
    // cross-map checks must not reject it.
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            source: './src/index.ts',
            default: './dist/index.js',
          },
          './ui/styles.css': {
            source: './src/ui/styles.css',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              default: './dist/index.js',
            },
          },
        },
        files: ['dist'],
      },
      false,
    )
  })
})
