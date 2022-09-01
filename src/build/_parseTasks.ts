import fs from 'fs'
import path from 'path'
import {PackageExport, PackageFormat, PackageRuntime} from '../core'
import {_BuildContext} from './_types'
import {_BuildTask, _DtsTask, _RollupTask, _RollupTaskEntry} from './tasks'

/**
 * @internal
 */
export function _parseTasks(ctx: _BuildContext): _BuildTask[] {
  const {cwd, pkg, target} = ctx

  const tasks: _BuildTask[] = []

  const exports = Object.entries(ctx.exports || {}).map(
    ([_path, exp]) => ({_path, ...exp} as PackageExport & {_path: string})
  )

  const dtsTasks: Record<string, _DtsTask> = {}
  const rollupTasks: Record<string, _RollupTask> = {}

  function _addRollupTaskEntry(
    format: PackageFormat,
    runtime: PackageRuntime,
    entry: _RollupTaskEntry
  ) {
    const buildId = `${format}:${runtime}`

    if (!rollupTasks[buildId]) {
      rollupTasks[buildId] = {
        type: 'rollup',
        buildId,
        entries: [entry],
        runtime,
        format,
        target: target[runtime],
      }
    } else {
      rollupTasks[buildId].entries.push(entry)
    }
  }

  // Parse `dts` tasks
  for (const exp of exports) {
    const exportId = path.join(pkg.name, exp._path)

    if (exp.types) {
      if (!dtsTasks[exportId]) {
        dtsTasks[exportId] = {
          type: 'dts',
          exportId,
          exportPath: exp._path === '.' ? './index' : exp._path,
          source: exp.source,
          output: exp.types,
        }
      }
    }
  }

  // Parse rollup:commonjs:* tasks
  for (const exp of exports) {
    const output = exp.require

    if (!output) continue

    _addRollupTaskEntry('commonjs', ctx.runtime, {
      path: exp._path,
      source: exp.source,
      output,
    })
  }

  // Parse rollup:commonjs:browser tasks
  for (const exp of exports) {
    const output = exp.browser?.require

    if (!output) continue

    _addRollupTaskEntry('commonjs', 'browser', {
      path: exp._path,
      source: exp.browser?.source || exp.source,
      output,
    })
  }

  // Parse rollup:esm:* tasks
  for (const exp of exports) {
    const output = exp.import

    if (!output) continue

    _addRollupTaskEntry('esm', ctx.runtime, {
      path: exp._path,
      source: exp.source,
      output,
    })
  }

  // Parse rollup:esm:browser tasks
  for (const exp of exports) {
    const output = exp.browser?.import

    if (!output) continue

    _addRollupTaskEntry('esm', 'browser', {
      path: exp._path,
      source: exp.browser?.source || exp.source,
      output,
    })
  }

  tasks.push(...Object.values(dtsTasks))
  tasks.push(...Object.values(rollupTasks))

  // Parse rollup:esm:browser tasks
  for (const exp of exports) {
    if (exp._exported && exp._path !== '.') {
      const target = exp.browser?.import || exp.import

      if (target) {
        fs.writeFileSync(
          path.resolve(cwd, `${exp._path}.js`),
          [
            `// THIS FILE IS GENERATED – DO NOT EDIT`,
            `export {default} from '${target}'`,
            `export * from '${target}'`,
            ``,
          ].join('\n')
        )
      }
    }
  }

  if (ctx.extract && pkg.types) {
    tasks.push({
      type: 'extract',
      mainEntryPointPath: pkg.types,
    })
  }

  return tasks
}
