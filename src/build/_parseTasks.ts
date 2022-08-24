import path from 'path'
import {PackageSubPathExportEntry} from '../core'
import {_BuildContext} from './_types'
import {_RollupTask, _BuildTask, _DtsTask} from './tasks'

/**
 * @internal
 */
export function _parseTasks(ctx: _BuildContext): _BuildTask[] {
  const {pkg} = ctx

  const entries = Object.entries(ctx.exports || {}).map(
    ([path, entry]) => ({path, ...entry} as PackageSubPathExportEntry & {path: string})
  )

  const dtsTasks: Record<string, _DtsTask> = {}
  const rollupTasks: Record<string, _RollupTask> = {}

  // Parse `dts` tasks
  for (const entry of entries) {
    const exportId = path.join(pkg.name, entry.path)

    if (entry.types) {
      if (!dtsTasks[exportId]) {
        dtsTasks[exportId] = {
          type: 'dts',
          exportId,
          exportPath: entry.path === '.' ? './index' : entry.path,
          source: entry.source,
          output: entry.types,
        }
      }
    }
  }

  // Parse `rollup` tasks
  for (const entry of entries) {
    const format: ('commonjs' | 'esm')[] = []
    const target: string[] = []

    if (entry.require) {
      format.push('commonjs')
    }

    if (entry.default) {
      format.push('esm')
    }

    if (entry.runtime === 'node') {
      target.push('node12')
    }

    if (entry.runtime === 'web') {
      target.push('chrome104')
    }

    for (const f of format) {
      const buildId = `${entry.runtime}:${f}:${target.join(',')}`

      if (!rollupTasks[buildId]) {
        rollupTasks[buildId] = {
          type: 'rollup',
          buildId,
          entries: [entry],
          runtime: entry.runtime,
          format: f,
          target,
        }
      } else {
        rollupTasks[buildId].entries.push(entry)
      }
    }
  }

  const tasks: _BuildTask[] = [...Object.values(dtsTasks), ...Object.values(rollupTasks)]

  if (ctx.extract && pkg.types) {
    tasks.push({
      type: 'extract',
      mainEntryPointPath: pkg.types,
    })
  }

  return tasks
}
