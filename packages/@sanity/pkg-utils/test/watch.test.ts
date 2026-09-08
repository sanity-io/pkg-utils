import {up as findPkgPath} from 'empathic/package'
import {build as tsdownBuild, type TsdownHandle} from 'tsdown'
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest'
import {loadConfig} from '../src/node/core/config/loadConfig'
import {loadPkgWithReporting} from '../src/node/core/pkg/loadPkgWithReporting'
import {createLogger} from '../src/node/logger'
import {resolveBuildContext} from '../src/node/resolveBuildContext'
import {resolveTsdownBuilds} from '../src/node/tasks/tsdown/resolveTsdownBuilds'
import {watch} from '../src/node/watch'
import {spawnProject} from './env/spawnProject'

vi.mock('tsdown', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tsdown')>()
  return {
    ...actual,
    build: vi.fn(),
  }
})

function mockWatchHandle(): {
  handle: TsdownHandle
  close: ReturnType<typeof vi.fn>
  restart: ReturnType<typeof vi.fn>
} {
  const close = vi.fn(async () => {})
  const restart = vi.fn(async () => {
    throw new Error('watch.restart() must not be used')
  })
  return {
    close,
    restart,
    handle: {bundles: [], watch: {close, restart}},
  }
}

async function resolveProjectBuilds(projectCwd: string) {
  const logger = createLogger(true) // quiet mode
  const pkgPath = findPkgPath({cwd: projectCwd})!
  const config = await loadConfig({cwd: projectCwd, pkgPath})
  const {parseStrictOptions} = await import('../src/node/strict')
  const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
  const pkg = await loadPkgWithReporting({pkgPath, logger, strict: false, strictOptions})
  const tsconfig = config?.tsconfig || 'tsconfig.json'

  const ctx = await resolveBuildContext({
    config,
    cwd: projectCwd,
    logger,
    pkg,
    strict: false,
    tsconfig,
  })
  return resolveTsdownBuilds(ctx)
}

describe.skipIf(process.platform === 'win32')('watch functionality', () => {
  let abort: AbortController | undefined

  beforeEach(() => {
    vi.mocked(tsdownBuild).mockReset()
  })

  afterEach(() => {
    abort?.abort()
    abort = undefined
  })

  test('resolves the build waterfall for a TypeScript project', async () => {
    const project = await spawnProject('ts')
    const builds = await resolveProjectBuilds(project.cwd)

    expect(builds.length).toBeGreaterThan(0)
    const canonical = builds.at(-1)
    expect(canonical?.canonical).toBe(true)
    expect(canonical?.entries.length).toBeGreaterThan(0)
    expect(canonical?.entries[0]).toHaveProperty('alias')
    expect(canonical?.entries[0]).toHaveProperty('source')
    expect(canonical?.entries[0]).toHaveProperty('formats')
  })

  test('resolves the build waterfall for a JavaScript project', async () => {
    const project = await spawnProject('js')
    const builds = await resolveProjectBuilds(project.cwd)

    expect(builds.length).toBeGreaterThan(0)
    expect(builds.at(-1)?.canonical).toBe(true)
  })

  test('resolves multi-export projects into one canonical build with multiple entries', async () => {
    const project = await spawnProject('multi-export')
    const builds = await resolveProjectBuilds(project.cwd)

    const canonical = builds.at(-1)
    expect(canonical?.canonical).toBe(true)
    expect((canonical?.entries.length ?? 0) > 1).toBe(true)
  })

  test('resolves `bundles` with a runtime into their own build', async () => {
    const project = await spawnProject('browser-bundle')
    const builds = await resolveProjectBuilds(project.cwd)

    expect(builds.length).toBeGreaterThan(1)
    expect(builds.some((build) => !build.canonical)).toBe(true)
    expect(builds.at(-1)?.canonical).toBe(true)
  })

  test('abort closes published handles and does not start another build', async () => {
    const project = await spawnProject('multi-exports-commonjs')
    const builds = await resolveProjectBuilds(project.cwd)
    const published = Array.from({length: builds.length}, () => mockWatchHandle())
    vi.mocked(tsdownBuild).mockImplementation(async () => {
      const next = published[vi.mocked(tsdownBuild).mock.calls.length - 1]
      if (!next) throw new Error('unexpected extra tsdown build')
      return next.handle
    })

    abort = new AbortController()
    await watch({
      cwd: project.cwd,
      strict: false,
      signal: abort.signal,
    })

    await vi.waitFor(() => {
      expect(tsdownBuild).toHaveBeenCalledTimes(builds.length)
    })

    abort.abort()

    await vi.waitFor(() => {
      for (const {close, restart} of published) {
        expect(close).toHaveBeenCalledTimes(1)
        expect(restart).not.toHaveBeenCalled()
      }
    })
    expect(tsdownBuild).toHaveBeenCalledTimes(builds.length)
  })

  test('abort during an in-flight build closes that handle and does not rebuild', async () => {
    const project = await spawnProject('multi-exports-commonjs')
    const pending = Promise.withResolvers<TsdownHandle>()
    vi.mocked(tsdownBuild).mockReturnValue(pending.promise)

    abort = new AbortController()
    await watch({
      cwd: project.cwd,
      strict: false,
      signal: abort.signal,
    })

    await vi.waitFor(() => {
      expect(tsdownBuild).toHaveBeenCalledTimes(1)
    })

    abort.abort()

    const {handle, close, restart} = mockWatchHandle()
    pending.resolve(handle)

    await vi.waitFor(() => {
      expect(close).toHaveBeenCalledTimes(1)
    })
    expect(restart).not.toHaveBeenCalled()
    expect(tsdownBuild).toHaveBeenCalledTimes(1)
  })
})
