import type {PackageJSON} from '@sanity/parse-package-json'
import {describe, expect, test, vi} from 'vitest'
import {checkDependencyPlacement} from '../src/node/core/pkg/dependencyPlacement'
import type {Logger} from '../src/node/logger'
import {parseStrictOptions} from '../src/node/strict'

function createMockLogger(): {
  logger: Logger
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
} {
  const warn = vi.fn()
  const error = vi.fn()
  const logger: Logger = {
    log: vi.fn(),
    info: vi.fn(),
    warn,
    error,
    success: vi.fn(),
  }
  return {logger, warn, error}
}

function basePkg(overrides: Partial<PackageJSON>): PackageJSON {
  return {
    name: 'test-pkg',
    version: '1.0.0',
    license: 'MIT',
    type: 'module',
    ...overrides,
  }
}

describe('checkDependencyPlacement', () => {
  test('errors when a "no peer dependency" package is in peerDependencies', () => {
    const {logger, error} = createMockLogger()
    const shouldError = checkDependencyPlacement({
      pkg: basePkg({peerDependencies: {'react-is': '^18.0.0'}}),
      logger,
      strictOptions: parseStrictOptions({noReactIsPeerDependency: 'error'}),
    })

    expect(shouldError).toBe(true)
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]?.[0]).toContain('`react-is` should not be in `peerDependencies`')
    expect(error.mock.calls[0]?.[0]).toContain('`dependencies` or `devDependencies`')
  })

  test('errors by default', () => {
    const {logger, warn, error} = createMockLogger()
    const shouldError = checkDependencyPlacement({
      pkg: basePkg({peerDependencies: {'react-is': '^18.0.0'}}),
      logger,
      strictOptions: parseStrictOptions({}),
    })

    expect(shouldError).toBe(true)
    expect(warn).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]?.[0]).toContain('`react-is` should not be in `peerDependencies`')
  })

  test('can be downgraded to "warn"', () => {
    const {logger, warn, error} = createMockLogger()
    const shouldError = checkDependencyPlacement({
      pkg: basePkg({peerDependencies: {'react-is': '^18.0.0'}}),
      logger,
      strictOptions: parseStrictOptions({noReactIsPeerDependency: 'warn'}),
    })

    expect(shouldError).toBe(false)
    expect(error).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('`react-is` should not be in `peerDependencies`')
  })

  test('does nothing when the rule is disabled with "off"', () => {
    const {logger, warn, error} = createMockLogger()
    const shouldError = checkDependencyPlacement({
      pkg: basePkg({peerDependencies: {'react-is': '^18.0.0'}}),
      logger,
      strictOptions: parseStrictOptions({noReactIsPeerDependency: 'off'}),
    })

    expect(shouldError).toBe(false)
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  test('errors when a "no dependency" package is in dependencies', () => {
    const {logger, error} = createMockLogger()
    const shouldError = checkDependencyPlacement({
      pkg: basePkg({dependencies: {sanity: '^5.0.0'}}),
      logger,
      strictOptions: parseStrictOptions({noSanityDependency: 'error'}),
    })

    expect(shouldError).toBe(true)
    expect(error.mock.calls[0]?.[0]).toContain('`sanity` should not be in `dependencies`')
    expect(error.mock.calls[0]?.[0]).toContain('`devDependencies` or `peerDependencies`')
  })

  test('only considers own properties, not inherited ones', () => {
    const {logger, warn, error} = createMockLogger()
    // A dependency map that inherits `react-is` from its prototype but does not own
    // it. Using the `in` operator would incorrectly flag this; an own-property check
    // does not.
    const peerDependencies: Record<string, string> = Object.create({'react-is': '^18.0.0'})
    const shouldError = checkDependencyPlacement({
      pkg: basePkg({peerDependencies}),
      logger,
      strictOptions: parseStrictOptions({noReactIsPeerDependency: 'error'}),
    })

    expect(shouldError).toBe(false)
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  test('allows correct placements without any report', () => {
    const {logger, warn, error} = createMockLogger()
    const shouldError = checkDependencyPlacement({
      pkg: basePkg({
        dependencies: {
          'react-is': '^18.0.0',
          '@sanity/ui': '^3.0.0',
          '@sanity/icons': '^3.0.0',
          'rxjs': '^7.0.0',
        },
        devDependencies: {'react': '^19.0.0', 'sanity': '^5.0.0', '@types/react': '^19.0.0'},
        peerDependencies: {react: '^18 || ^19', sanity: '^5.0.0'},
      }),
      logger,
      strictOptions: parseStrictOptions({}),
    })

    expect(shouldError).toBe(false)
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  describe('@types/* peer version constraint', () => {
    test.each(['@types/react', '@types/react-dom', '@types/node'])(
      'errors when %s is a peer dependency without the "*" range',
      (name) => {
        const {logger, error} = createMockLogger()
        const shouldError = checkDependencyPlacement({
          pkg: basePkg({peerDependencies: {[name]: '^19.0.0'}}),
          logger,
          strictOptions: parseStrictOptions({
            noReactTypesDependency: 'error',
            noReactDomTypesDependency: 'error',
            noNodeTypesDependency: 'error',
          }),
        })

        expect(shouldError).toBe(true)
        expect(error.mock.calls[0]?.[0]).toContain(
          `\`${name}\` in \`peerDependencies\` should be set to "*"`,
        )
      },
    )

    test.each(['@types/react', '@types/react-dom', '@types/node'])(
      'allows %s as a peer dependency with the "*" range',
      (name) => {
        const {logger, warn, error} = createMockLogger()
        const shouldError = checkDependencyPlacement({
          pkg: basePkg({peerDependencies: {[name]: '*'}}),
          logger,
          strictOptions: parseStrictOptions({}),
        })

        expect(shouldError).toBe(false)
        expect(warn).not.toHaveBeenCalled()
        expect(error).not.toHaveBeenCalled()
      },
    )

    test('errors when @types/react is in dependencies regardless of version', () => {
      const {logger, error} = createMockLogger()
      const shouldError = checkDependencyPlacement({
        pkg: basePkg({dependencies: {'@types/react': '*'}}),
        logger,
        strictOptions: parseStrictOptions({noReactTypesDependency: 'error'}),
      })

      expect(shouldError).toBe(true)
      expect(error.mock.calls[0]?.[0]).toContain('`@types/react` should not be in `dependencies`')
    })
  })

  test('reports every violating package independently', () => {
    const {logger, error} = createMockLogger()
    const shouldError = checkDependencyPlacement({
      pkg: basePkg({
        dependencies: {'react': '^19.0.0', 'styled-components': '^6.0.0'},
        peerDependencies: {'rxjs': '^7.0.0', '@sanity/client': '^6.0.0'},
      }),
      logger,
      strictOptions: parseStrictOptions({
        noReactDependency: 'error',
        noStyledComponentsDependency: 'error',
        noRxjsPeerDependency: 'error',
        noSanityClientPeerDependency: 'error',
      }),
    })

    expect(shouldError).toBe(true)
    expect(error).toHaveBeenCalledTimes(4)
  })
})
