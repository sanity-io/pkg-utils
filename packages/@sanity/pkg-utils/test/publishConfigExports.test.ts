import {mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe, expect, test} from 'vitest'
import {loadPkgWithReporting} from '../src/node/core/pkg/loadPkgWithReporting'
import {writeBundleCssExports} from '../src/node/core/pkg/writeBundleCssExports'
import {createLogger} from '../src/node/logger'
import {parseStrictOptions} from '../src/node/strict'

describe('publishConfig.exports validation', () => {
  const testDir = join(tmpdir(), 'pkg-utils-test-publishconfig')

  interface TestPackageOptions {
    beforeValidate?: (cwd: string) => Promise<void>
    strict?: boolean
    strictOptions?: unknown
  }

  async function testPackage(pkg: any, shouldFail: boolean, options: TestPackageOptions = {}) {
    const {beforeValidate, strict = true, strictOptions = {}} = options
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
        strict,
        strictOptions: parseStrictOptions(strictOptions),
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

  test.each([
    {strict: true, strictOptions: {noPublishConfigExports: 'warn'}},
    {strict: false, strictOptions: {noPublishConfigExports: 'off'}},
  ])(
    'should hard fail when development is not filtered out and strict is $strict',
    async ({strict, strictOptions}) => {
      await testPackage(
        {
          name: 'test-pkg',
          version: '1.0.0',
          license: 'MIT',
          type: 'module',
          exports: {
            '.': {
              development: './src/index.ts',
              default: './dist/index.js',
            },
          },
          files: ['dist'],
        },
        true,
        {strict, strictOptions},
      )
    },
  )

  test('should hard fail when publishConfig.exports retains development', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            development: './src/index.ts',
            default: './dist/index.js',
          },
        },
        publishConfig: {
          exports: {
            '.': {
              development: './src/index.ts',
              default: './dist/index.js',
            },
          },
        },
        files: ['dist'],
      },
      true,
      {strict: false, strictOptions: {noPublishConfigExports: 'off'}},
    )
  })

  test('should pass without strict mode when publishConfig.exports filters development', async () => {
    await testPackage(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
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
        files: ['dist'],
      },
      false,
      {strict: false, strictOptions: {noPublishConfigExports: 'off'}},
    )
  })

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

  // Regression test: a vanilla-extract build adds the `./bundle.css` export to `exports` via
  // `writeBundleCssExports` and then runs the strict `--check`. If the export is not mirrored into
  // `publishConfig.exports`, the check fails with "missing export path". This asserts the build +
  // check stays green for packages that declare `publishConfig.exports`.
  test('should pass after writeBundleCssExports mirrors the css export into publishConfig.exports', async () => {
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
          './package.json': './package.json',
        },
        publishConfig: {
          exports: {
            '.': {
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
        },
        files: ['dist'],
      },
      false,
      {
        beforeValidate: async (cwd) => {
          await writeBundleCssExports({
            cwd,
            distPath: join(cwd, 'dist'),
            cssName: 'bundle.css',
            logger: createLogger(true),
          })
        },
      },
    )
  })
})
