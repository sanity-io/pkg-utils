import {detect} from 'package-manager-detector/detect'
import {beforeEach, describe, expect, test, vi} from 'vitest'
import {defineConfig} from '../src/index.ts'

vi.mock('package-manager-detector/detect')

const mockedDetect = vi.mocked(detect)

describe('devExports default', () => {
  beforeEach(() => {
    mockedDetect.mockReset()
  })

  test('is enabled when pnpm is detected', async () => {
    mockedDetect.mockResolvedValue({name: 'pnpm', agent: 'pnpm'})

    expect((await defineConfig()).exports).toEqual({
      devExports: true,
    })
    expect(mockedDetect).toHaveBeenCalledWith({cwd: process.cwd()})
  })

  test.each([
    {name: 'npm', agent: 'npm'},
    {name: 'yarn', agent: 'yarn@berry'},
    {name: 'bun', agent: 'bun'},
  ] as const)('is not enabled when $name is detected', async (packageManager) => {
    mockedDetect.mockResolvedValue(packageManager)

    expect((await defineConfig()).exports).toBe(true)
  })

  test('is not enabled when no package manager can be detected', async () => {
    mockedDetect.mockResolvedValue(null)

    expect((await defineConfig()).exports).toBe(true)
  })

  test('still merges other export options when pnpm is not detected', async () => {
    mockedDetect.mockResolvedValue({name: 'npm', agent: 'npm'})

    // Scalar `true` default is replaced by an object overlay (mergeConfig semantics)
    expect((await defineConfig({exports: {all: true}})).exports).toEqual({
      all: true,
    })
  })

  test('allows userland to enable dev exports explicitly', async () => {
    mockedDetect.mockResolvedValue({name: 'npm', agent: 'npm'})

    expect((await defineConfig({exports: {devExports: true}})).exports).toEqual({
      devExports: true,
    })
    // An explicit `devExports` makes the pnpm-gated default unreachable, so the detection
    // is skipped entirely
    expect(mockedDetect).not.toHaveBeenCalled()
  })

  test('detects from the `cwd` option instead of process.cwd() when provided', async () => {
    mockedDetect.mockResolvedValue({name: 'pnpm', agent: 'pnpm'})

    expect((await defineConfig({cwd: '/somewhere/else'})).exports).toEqual({
      devExports: true,
    })
    expect(mockedDetect).toHaveBeenCalledWith({cwd: '/somewhere/else'})
  })
})

describe('package-manager detection only runs when it decides the devExports default', () => {
  beforeEach(() => {
    mockedDetect.mockReset()
    mockedDetect.mockResolvedValue({name: 'pnpm', agent: 'pnpm'})
  })

  test.each([
    // `false`, `true` and bare CI conditions replace the defaults entirely (mergeConfig
    // semantics), so the pnpm-gated `devExports` default can never apply
    {exports: false as const},
    {exports: true as const},
    {exports: 'ci-only' as const},
    {exports: 'local-only' as const},
    // An explicit `devExports` value (any value) overrides the default
    {exports: {devExports: 'source'} as const},
    {exports: {devExports: false} as const},
    {exports: {enabled: 'ci-only', devExports: true} as const},
  ])('is skipped for exports: $exports', async ({exports}) => {
    await defineConfig({exports})
    expect(mockedDetect).not.toHaveBeenCalled()
  })

  test.each([
    // The default can still apply: no userland value, or an object that leaves `devExports`
    // to the default (mergeConfig ignores explicit `undefined`)
    {},
    {exports: {} as const},
    {exports: {all: true} as const},
    {exports: {enabled: 'ci-only'} as const},
    {exports: {devExports: undefined} as const},
  ])('runs for %o', async (options) => {
    await defineConfig(options)
    expect(mockedDetect).toHaveBeenCalledTimes(1)
  })
})
