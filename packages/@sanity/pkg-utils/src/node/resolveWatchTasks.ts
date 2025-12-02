import type {PkgExport, PkgFormat, PkgRuntime} from './core/config/types.ts'
import type {BuildContext} from './core/contexts/buildContext.ts'
import type {TsdownTaskEntry, TsdownWatchTask, WatchTask} from './tasks/types.ts'

/** @internal */
export function resolveWatchTasks(ctx: BuildContext): WatchTask[] {
  const {target} = ctx
  const tasks: WatchTask[] = []

  const exports = Object.entries(ctx.exports || {}).map(
    ([_path, exp]) => ({_path, ...exp}) as PkgExport & {_path: string},
  )

  const tsdownTasks: Record<string, TsdownWatchTask> = {}

  function addTsdownTaskEntry(format: PkgFormat, runtime: PkgRuntime, entry: TsdownTaskEntry) {
    const buildId = `${format}:${runtime}`

    if (tsdownTasks[buildId]) {
      tsdownTasks[buildId].entries.push(entry)
    } else {
      tsdownTasks[buildId] = {
        type: 'watch:tsdown',
        buildId,
        entries: [entry],
        runtime,
        format,
        target: target[runtime],
      }
    }
  }

  // Parse tsdown:commonjs:* tasks
  for (const exp of exports) {
    const output = exp.require

    if (!output) continue

    addTsdownTaskEntry('commonjs', ctx.runtime, {
      path: exp._path,
      source: exp.source,
      output,
    })
  }

  // Parse tsdown:commonjs:browser tasks
  for (const exp of exports) {
    const output = exp.browser?.require

    if (!output) continue

    addTsdownTaskEntry('commonjs', 'browser', {
      path: exp._path,
      source: exp.browser?.source || exp.source,
      output,
    })
  }

  // Parse tsdown:esm:* tasks
  for (const exp of exports) {
    const output = exp.import

    if (!output) continue

    addTsdownTaskEntry('esm', ctx.runtime, {
      path: exp._path,
      source: exp.source,
      output,
    })
  }

  // Parse tsdown:esm:browser tasks
  for (const exp of exports) {
    const output = exp.browser?.import

    if (!output) continue

    addTsdownTaskEntry('esm', 'browser', {
      path: exp._path,
      source: exp.browser?.source || exp.source,
      output,
    })
  }

  tasks.push(...Object.values(tsdownTasks))

  return tasks
}
