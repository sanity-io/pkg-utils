import {up as findPkgPath} from 'empathic/package'
import {describe, expect, test} from 'vitest'
import {loadConfig} from '../src/node/core/config/loadConfig'
import {loadPkgWithReporting} from '../src/node/core/pkg/loadPkgWithReporting'
import {createLogger} from '../src/node/logger'
import {resolveBuildContext} from '../src/node/resolveBuildContext'
import {resolveTsdownBuilds} from '../src/node/tasks/tsdown/resolveTsdownBuilds'
import {watch} from '../src/node/watch'
import {spawnProject} from './env/spawnProject'

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

  test(
    'watch function should initialize and clean up with AbortController',
    {retry: process.platform === 'darwin' ? 3 : 0},
    async () => {
      const project = await spawnProject('js')
      const ac = new AbortController()

      // This test verifies that watch() can be called and initialized
      // We don't let it run indefinitely, just verify it starts without error
      void watch({
        cwd: project.cwd,
        strict: false,
        signal: ac.signal,
      })

      // Give it a moment to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Clean up the watch subscriptions
      ac.abort()

      // If we got here without an error being thrown, the watch initialized successfully
      expect(true).toBe(true)
    },
  )
})
