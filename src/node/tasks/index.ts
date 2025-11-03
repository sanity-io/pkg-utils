import {dtsTask} from './dts/dtsTask.ts'
import {dtsWatchTask} from './dts/dtsWatchTask.ts'
import {rolldownDtsTask} from './rolldown/rolldownDtsTask.ts'
import {rollupTask} from './rollup/rollupTask.ts'
import {rollupWatchTask} from './rollup/rollupWatchTask.ts'
import type {BuildTaskHandlers, WatchTaskHandlers} from './types.ts'

/** @internal */
export const buildTaskHandlers: BuildTaskHandlers = {
  'build:dts': dtsTask,
  'build:js': rollupTask,
  'rolldown:dts': rolldownDtsTask,
}

/** @internal */
export const watchTaskHandlers: WatchTaskHandlers = {
  'watch:dts': dtsWatchTask,
  'watch:js': rollupWatchTask,
}
