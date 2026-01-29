import {describe, expect, test, vi} from 'vitest'
import type {PackageJSON} from '@sanity/parse-package-json'
import {resolveBuildContext} from '../src/node/resolveBuildContext'
import {createLogger} from '../src/node/logger'

describe('styled-components auto-detection', () => {
  test('should not modify config when both styled-components and babel-plugin are present', async () => {
    const pkg: PackageJSON = {
      name: 'test-package',
      version: '1.0.0',
      type: 'module',
      peerDependencies: {
        'styled-components': '^6.0.0',
      },
      devDependencies: {
        'babel-plugin-styled-components': '^2.1.4',
      },
      exports: {
        '.': {
          source: './src/index.ts',
          import: './dist/index.js',
          require: './dist/index.cjs',
          default: './dist/index.js',
        },
      },
      browserslist: 'extends @sanity/browserslist-config',
    }

    const logSpy = vi.fn()
    const warnSpy = vi.fn()
    const logger = createLogger(false)
    logger.log = logSpy
    logger.warn = warnSpy

    const ctx = await resolveBuildContext({
      config: undefined,
      cwd: '/test',
      logger,
      pkg,
      strict: false,
      tsconfig: 'tsconfig.json',
    })

    // Config should not be modified in resolveBuildContext - the auto-detection happens in resolveRollupConfig
    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(ctx.config?.babel?.styledComponents).toBeUndefined()
  })

  test('should warn when styled-components is present but babel-plugin is not', async () => {
    const pkg: PackageJSON = {
      name: 'test-package',
      version: '1.0.0',
      type: 'module',
      peerDependencies: {
        'styled-components': '^6.0.0',
      },
      exports: {
        '.': {
          source: './src/index.ts',
          import: './dist/index.js',
          require: './dist/index.cjs',
          default: './dist/index.js',
        },
      },
      browserslist: 'extends @sanity/browserslist-config',
    }

    const logSpy = vi.fn()
    const warnSpy = vi.fn()
    const logger = createLogger(false)
    logger.log = logSpy
    logger.warn = warnSpy

    const ctx = await resolveBuildContext({
      config: undefined,
      cwd: '/test',
      logger,
      pkg,
      strict: false,
      tsconfig: 'tsconfig.json',
    })

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Consider installing babel-plugin-styled-components'),
    )
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Automatically enabling'),
    )
    expect(ctx.config?.babel?.styledComponents).toBeUndefined()
  })

  test('should not auto-enable when styledComponents is explicitly set to false', async () => {
    const pkg: PackageJSON = {
      name: 'test-package',
      version: '1.0.0',
      type: 'module',
      peerDependencies: {
        'styled-components': '^6.0.0',
      },
      devDependencies: {
        'babel-plugin-styled-components': '^2.1.4',
      },
      exports: {
        '.': {
          source: './src/index.ts',
          import: './dist/index.js',
          require: './dist/index.cjs',
          default: './dist/index.js',
        },
      },
      browserslist: 'extends @sanity/browserslist-config',
    }

    const logSpy = vi.fn()
    const warnSpy = vi.fn()
    const logger = createLogger(false)
    logger.log = logSpy
    logger.warn = warnSpy

    const ctx = await resolveBuildContext({
      config: {
        babel: {
          styledComponents: false,
        },
      },
      cwd: '/test',
      logger,
      pkg,
      strict: false,
      tsconfig: 'tsconfig.json',
    })

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Automatically enabling'))
    expect(warnSpy).not.toHaveBeenCalled()
    expect(ctx.config?.babel?.styledComponents).toBe(false)
  })

  test('should not auto-enable when styledComponents is explicitly set to true', async () => {
    const pkg: PackageJSON = {
      name: 'test-package',
      version: '1.0.0',
      type: 'module',
      peerDependencies: {
        'styled-components': '^6.0.0',
      },
      devDependencies: {
        'babel-plugin-styled-components': '^2.1.4',
      },
      exports: {
        '.': {
          source: './src/index.ts',
          import: './dist/index.js',
          require: './dist/index.cjs',
          default: './dist/index.js',
        },
      },
      browserslist: 'extends @sanity/browserslist-config',
    }

    const logSpy = vi.fn()
    const warnSpy = vi.fn()
    const logger = createLogger(false)
    logger.log = logSpy
    logger.warn = warnSpy

    const ctx = await resolveBuildContext({
      config: {
        babel: {
          styledComponents: true,
        },
      },
      cwd: '/test',
      logger,
      pkg,
      strict: false,
      tsconfig: 'tsconfig.json',
    })

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Automatically enabling'))
    expect(warnSpy).not.toHaveBeenCalled()
    expect(ctx.config?.babel?.styledComponents).toBe(true)
  })

  test('should not warn when styled-components is not in peerDependencies', async () => {
    const pkg: PackageJSON = {
      name: 'test-package',
      version: '1.0.0',
      type: 'module',
      exports: {
        '.': {
          source: './src/index.ts',
          import: './dist/index.js',
          require: './dist/index.cjs',
          default: './dist/index.js',
        },
      },
      browserslist: 'extends @sanity/browserslist-config',
    }

    const logSpy = vi.fn()
    const warnSpy = vi.fn()
    const logger = createLogger(false)
    logger.log = logSpy
    logger.warn = warnSpy

    const ctx = await resolveBuildContext({
      config: undefined,
      cwd: '/test',
      logger,
      pkg,
      strict: false,
      tsconfig: 'tsconfig.json',
    })

    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('styled-components'))
    expect(warnSpy).not.toHaveBeenCalled()
    expect(ctx.config?.babel?.styledComponents).toBeUndefined()
  })
})
