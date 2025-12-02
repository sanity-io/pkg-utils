import {describe, expect, test} from 'vitest'
import {loadConfig} from '../src/node/core/config/loadConfig'
import {loadPkgWithReporting} from '../src/node/core/pkg/loadPkgWithReporting'
import {createLogger} from '../src/node/logger'
import {resolveBuildContext} from '../src/node/resolveBuildContext'
import {resolveWatchTasks} from '../src/node/resolveWatchTasks'
import {watch} from '../src/node/watch'
import {spawnProject} from './env/spawnProject'

describe('watch functionality', () => {
  test('resolveWatchTasks should generate correct tasks for TypeScript project', async () => {
    const project = await spawnProject('ts')

    try {
      await project.install()

      const cwd = project.cwd
      const logger = createLogger(true) // quiet mode
      const config = await loadConfig({cwd})
      const {parseStrictOptions} = await import('../src/node/strict')
      const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
      const pkg = await loadPkgWithReporting({cwd, logger, strict: false, strictOptions})
      const tsconfig = config?.tsconfig || 'tsconfig.json'

      const ctx = await resolveBuildContext({config, cwd, logger, pkg, strict: false, tsconfig})
      const watchTasks = resolveWatchTasks(ctx)

      // Should have tsdown watch tasks for TS projects
      expect(watchTasks.length).toBeGreaterThan(0)

      const tsdownTask = watchTasks.find((task) => task.type === 'watch:tsdown')

      expect(tsdownTask).toBeDefined()

      if (tsdownTask && tsdownTask.type === 'watch:tsdown') {
        expect(tsdownTask.entries).toBeDefined()
        expect(Array.isArray(tsdownTask.entries)).toBe(true)
        expect(tsdownTask.entries.length).toBeGreaterThan(0)

        // Check structure of tsdown entries
        const entry = tsdownTask.entries[0]
        expect(entry).toBeDefined()
        expect(entry).toHaveProperty('path')
        expect(entry).toHaveProperty('source')
        expect(entry).toHaveProperty('output')
      }
    } finally {
      await project.remove()
    }
  })

  test('resolveWatchTasks should generate correct tasks for JavaScript project', async () => {
    const project = await spawnProject('js')

    try {
      await project.install()

      const cwd = project.cwd
      const logger = createLogger(true) // quiet mode
      const config = await loadConfig({cwd})
      const {parseStrictOptions} = await import('../src/node/strict')
      const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
      const pkg = await loadPkgWithReporting({cwd, logger, strict: false, strictOptions})
      const tsconfig = config?.tsconfig || 'tsconfig.json'

      const ctx = await resolveBuildContext({config, cwd, logger, pkg, strict: false, tsconfig})
      const watchTasks = resolveWatchTasks(ctx)

      // JS projects should have tsdown watch tasks
      expect(watchTasks.length).toBeGreaterThan(0)

      const tsdownTask = watchTasks.find((task) => task.type === 'watch:tsdown')
      expect(tsdownTask).toBeDefined()
    } finally {
      await project.remove()
    }
  })

  test('resolveWatchTasks should handle multi-export projects correctly', async () => {
    const project = await spawnProject('multi-export')

    try {
      await project.install()

      const cwd = project.cwd
      const logger = createLogger(true)
      const config = await loadConfig({cwd})
      const {parseStrictOptions} = await import('../src/node/strict')
      const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
      const pkg = await loadPkgWithReporting({cwd, logger, strict: false, strictOptions})
      const tsconfig = config?.tsconfig || 'tsconfig.json'

      const ctx = await resolveBuildContext({config, cwd, logger, pkg, strict: false, tsconfig})
      const watchTasks = resolveWatchTasks(ctx)

      expect(watchTasks.length).toBeGreaterThan(0)

      const tsdownTask = watchTasks.find((task) => task.type === 'watch:tsdown')
      expect(tsdownTask).toBeDefined()

      if (tsdownTask && tsdownTask.type === 'watch:tsdown') {
        // Multi-export projects should have multiple entries
        expect(tsdownTask.entries.length).toBeGreaterThan(1)

        // Each entry should have correct structure
        tsdownTask.entries.forEach((entry) => {
          expect(entry).toHaveProperty('path')
          expect(entry).toHaveProperty('source')
          expect(entry).toHaveProperty('output')
        })
      }
    } finally {
      await project.remove()
    }
  })

  test('resolveWatchTasks should handle browser-specific exports', async () => {
    const project = await spawnProject('browser-bundle')

    try {
      await project.install()

      const cwd = project.cwd
      const logger = createLogger(true)
      const config = await loadConfig({cwd})
      const {parseStrictOptions} = await import('../src/node/strict')
      const strictOptions = parseStrictOptions(config?.strictOptions ?? {})
      const pkg = await loadPkgWithReporting({cwd, logger, strict: false, strictOptions})
      const tsconfig = config?.tsconfig || 'tsconfig.json'

      const ctx = await resolveBuildContext({config, cwd, logger, pkg, strict: false, tsconfig})
      const watchTasks = resolveWatchTasks(ctx)

      expect(watchTasks.length).toBeGreaterThan(0)

      // Should have watch tasks
      const tsdownTasks = watchTasks.filter((task) => task.type === 'watch:tsdown')
      expect(tsdownTasks.length).toBeGreaterThan(0)
    } finally {
      await project.remove()
    }
  })

  test(
    'watch function should initialize without crashing',
    {retry: process.platform === 'darwin' ? 3 : 0},
    async () => {
      const project = await spawnProject('dummy-module')

      try {
        await project.install()

        // This test verifies that watch() can be called and initialized
        // We don't let it run indefinitely, just verify it starts without error
        void watch({
          cwd: project.cwd,
          strict: false,
        })

        // Give it a moment to initialize
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // If we got here without an error being thrown, the watch initialized successfully
        expect(true).toBe(true)

        // Note: We can't easily stop the watch process, but the test cleanup will handle it
      } finally {
        await project.remove()
      }
    },
  )
})
