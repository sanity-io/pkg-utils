import {mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe, expect, test} from 'vitest'
import {parseAndValidateExports} from '../src/node/core/pkg/parseAndValidateExports'
import {createLogger} from '../src/node/logger'

describe('monorepo export condition', () => {
  const testDir = join(tmpdir(), 'pkg-utils-test-monorepo')

  async function testMonorepoExport(pkg: any, shouldFail: boolean, expectedErrorMessage?: string) {
    const testPath = join(testDir, Math.random().toString(36).substring(7))
    mkdirSync(testPath, {recursive: true})
    const pkgPath = join(testPath, 'package.json')
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))

    const logger = createLogger(true)

    try {
      await parseAndValidateExports({
        cwd: testPath,
        pkg,
        strict: true,
        strictOptions: {
          noPackageJsonTypings: 'error',
          noImplicitSideEffects: 'warn',
          noImplicitBrowsersList: 'warn',
          alwaysPackageJsonTypes: 'off', // Disable for tests
          alwaysPackageJsonFiles: 'error',
          noCheckTypes: 'warn',
          noPackageJsonBrowser: 'warn',
          noPackageJsonTypesVersions: 'warn',
          preferModuleType: 'warn',
          noPublishConfigExports: 'warn',
        },
        logger,
      })

      if (shouldFail) {
        throw new Error('Expected validation to fail but it passed')
      }
    } catch (err: any) {
      if (!shouldFail) {
        throw err
      }
      if (expectedErrorMessage && !err.message.includes(expectedErrorMessage)) {
        throw new Error(
          `Expected error message to include "${expectedErrorMessage}" but got: ${err.message}`,
        )
      }
    } finally {
      rmSync(testPath, {recursive: true, force: true})
    }
  }

  test('should fail when monorepo condition is used without publishConfig.exports', async () => {
    await testMonorepoExport(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        packageManager: 'pnpm@9.0.0',
        exports: {
          '.': {
            monorepo: './src/index.ts',
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
        files: ['dist'],
      },
      true,
      'publishConfig.exports',
    )
  })

  test('should fail when monorepo condition is used without pnpm package manager', async () => {
    await testMonorepoExport(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        packageManager: 'npm@10.0.0',
        exports: {
          '.': {
            monorepo: './src/index.ts',
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
        publishConfig: {
          exports: {
            '.': './dist/index.js',
            './package.json': './package.json',
          },
        },
        files: ['dist'],
      },
      true,
      'pnpm',
    )
  })

  test('should fail when monorepo condition is used without packageManager field', async () => {
    await testMonorepoExport(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        exports: {
          '.': {
            monorepo: './src/index.ts',
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
        publishConfig: {
          exports: {
            '.': './dist/index.js',
            './package.json': './package.json',
          },
        },
        files: ['dist'],
      },
      true,
      'packageManager',
    )
  })

  test('should pass when monorepo condition is used with pnpm and publishConfig.exports', async () => {
    await testMonorepoExport(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        packageManager: 'pnpm@9.0.0',
        exports: {
          '.': {
            monorepo: './src/index.ts',
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
        publishConfig: {
          exports: {
            '.': './dist/index.js',
            './package.json': './package.json',
          },
        },
        files: ['dist'],
      },
      false,
    )
  })

  test('should pass when using source condition (backward compatibility)', async () => {
    await testMonorepoExport(
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
        files: ['dist'],
      },
      false,
    )
  })

  test('should accept monorepo condition without source', async () => {
    await testMonorepoExport(
      {
        name: 'test-pkg',
        version: '1.0.0',
        license: 'MIT',
        type: 'module',
        packageManager: 'pnpm@9.0.0',
        exports: {
          '.': {
            monorepo: './src/index.ts',
            require: './dist/index.cjs',
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
        publishConfig: {
          exports: {
            '.': {
              require: './dist/index.cjs',
              default: './dist/index.js',
            },
            './package.json': './package.json',
          },
        },
        files: ['dist'],
      },
      false,
    )
  })

  test('should pass when monorepo condition is used with yarn if in parent package.json has pnpm', async () => {
    // Create parent directory with pnpm packageManager
    const parentPath = join(testDir, 'parent-' + Math.random().toString(36).substring(7))
    mkdirSync(parentPath, {recursive: true})
    const parentPkgPath = join(parentPath, 'package.json')
    writeFileSync(
      parentPkgPath,
      JSON.stringify(
        {
          name: 'parent-monorepo',
          private: true,
          packageManager: 'pnpm@9.0.0',
        },
        null,
        2,
      ),
    )

    // Create child package directory
    const childPath = join(parentPath, 'packages', 'child')
    mkdirSync(childPath, {recursive: true})
    const childPkgPath = join(childPath, 'package.json')

    const pkg = {
      name: 'test-pkg',
      version: '1.0.0',
      license: 'MIT',
      type: 'module',
      exports: {
        '.': {
          monorepo: './src/index.ts',
          default: './dist/index.js',
        },
        './package.json': './package.json',
      },
      publishConfig: {
        exports: {
          '.': './dist/index.js',
          './package.json': './package.json',
        },
      },
      files: ['dist'],
    }
    writeFileSync(childPkgPath, JSON.stringify(pkg, null, 2))

    const logger = createLogger(true)

    try {
      await parseAndValidateExports({
        cwd: childPath,
        pkg,
        strict: true,
        strictOptions: {
          noPackageJsonTypings: 'error',
          noImplicitSideEffects: 'warn',
          noImplicitBrowsersList: 'warn',
          alwaysPackageJsonTypes: 'off', // Disable for tests
          alwaysPackageJsonFiles: 'error',
          noCheckTypes: 'warn',
          noPackageJsonBrowser: 'warn',
          noPackageJsonTypesVersions: 'warn',
          preferModuleType: 'warn',
          noPublishConfigExports: 'warn',
        },
        logger,
      })

      // Should pass - pnpm found in parent
    } catch (err: any) {
      throw new Error(`Expected validation to pass but got error: ${err.message}`)
    } finally {
      rmSync(parentPath, {recursive: true, force: true})
    }
  })
})
