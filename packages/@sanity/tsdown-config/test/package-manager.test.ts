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
      enabled: 'local-only',
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

    expect((await defineConfig()).exports).toEqual({
      enabled: 'local-only',
    })
  })

  test('is not enabled when no package manager can be detected', async () => {
    mockedDetect.mockResolvedValue(null)

    expect((await defineConfig()).exports).toEqual({
      enabled: 'local-only',
    })
  })

  test('still merges other export options when pnpm is not detected', async () => {
    mockedDetect.mockResolvedValue({name: 'npm', agent: 'npm'})

    expect((await defineConfig({exports: {all: true}})).exports).toEqual({
      enabled: 'local-only',
      all: true,
    })
  })

  test('allows userland to enable dev exports explicitly', async () => {
    mockedDetect.mockResolvedValue({name: 'npm', agent: 'npm'})

    expect((await defineConfig({exports: {devExports: true}})).exports).toEqual({
      enabled: 'local-only',
      devExports: true,
    })
  })
})
