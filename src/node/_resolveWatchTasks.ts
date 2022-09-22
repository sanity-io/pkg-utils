import fs from 'fs'
import path from 'path'
import {PkgExport, PkgFormat, PkgRuntime, _BuildContext} from './_core'
import {_WatchTask, _DtsWatchTask, _RollupWatchTask, _RollupTaskEntry} from './_tasks'

/** @internal */
export function _resolveWatchTasks(ctx: _BuildContext): _WatchTask[] {
  const {cwd, pkg, target} = ctx
  const tasks: _WatchTask[] = []

  const exports = Object.entries(ctx.exports || {}).map(
    ([_path, exp]) => ({_path, ...exp} as PkgExport & {_path: string})
  )

  const dtsTask: _DtsWatchTask = {
    type: 'watch:dts',
    entries: [],
  }

  const rollupTasks: Record<string, _RollupWatchTask> = {}

  function _addRollupTaskEntry(format: PkgFormat, runtime: PkgRuntime, entry: _RollupTaskEntry) {
    const buildId = `${format}:${runtime}`

    if (rollupTasks[buildId]) {
      rollupTasks[buildId].entries.push(entry)
    } else {
      rollupTasks[buildId] = {
        type: 'watch:js',
        buildId,
        entries: [entry],
        runtime,
        format,
        target: target[runtime],
      }
    }
  }

  // Parse `dts` tasks
  for (const exp of exports) {
    const importId = path.join(pkg.name, exp._path)

    if (exp.types) {
      dtsTask.entries.push({
        importId,
        exportPath: exp._path,
        sourcePath: exp.source,
        targetPath: exp.types,
      })
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

  if (dtsTask.entries.length) {
    tasks.push(dtsTask)
  }

  tasks.push(...Object.values(rollupTasks))

  // Parse rollup:esm:browser tasks
  for (const exp of exports) {
    if (exp._exported && exp._path !== '.') {
      const relativeTargetPath = (exp.browser?.import || exp.import || '').replace(/\.[^/.]+$/, '')

      if (relativeTargetPath) {
        fs.writeFileSync(
          path.resolve(cwd, `${exp._path}.js`),
          [
            `// AUTO-GENERATED – DO NOT EDIT`,
            ``,
            `export {default} from '${relativeTargetPath}'`,
            `export * from '${relativeTargetPath}'`,
            ``,
          ].join('\n')
        )
      }
    }
  }

  return tasks
}
