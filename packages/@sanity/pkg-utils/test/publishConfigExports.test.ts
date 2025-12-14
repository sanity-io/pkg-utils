import {mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe, expect, test} from 'vitest'
import {loadPkgWithReporting} from '../src/node/core/pkg/loadPkgWithReporting'
import {createLogger} from '../src/node/logger'

describe('publishConfig.exports validation', () => {
  const testDir = join(tmpdir(), 'pkg-utils-test-publishconfig')

  async function testPackage(pkg: any, shouldFail: boolean) {
    const testPath = join(testDir, Math.random().toString(36).substring(7))
    mkdirSync(testPath, {recursive: true})
    const pkgPath = join(testPath, 'package.json')
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

    const logger = createLogger(true)

    let exitCalled = false
    const originalExit = process.exit
    // Mock process.exit to prevent test from exiting
    process.exit = (() => {
      exitCalled = true
      throw new Error('process.exit called')
    }) as any

    try {
      await loadPkgWithReporting({
        pkgPath,
        logger,
        strict: true,
        strictOptions: {
          noPackageJsonTypings: 'error',
          noImplicitSideEffects: 'warn',
          noImplicitBrowsersList: 'warn',
          alwaysPackageJsonTypes: 'error',
          alwaysPackageJsonFiles: 'error',
          noCheckTypes: 'warn',
          noPackageJsonBrowser: 'warn',
          noPackageJsonTypesVersions: 'warn',
          preferModuleType: 'warn',
          noPublishConfigExports: 'warn',
        },
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
})
