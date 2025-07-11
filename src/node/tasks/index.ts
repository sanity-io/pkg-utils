import {dtsTask} from './dts/dtsTask'
import {dtsWatchTask} from './dts/dtsWatchTask'
import {rolldownDtsTask} from './rolldown/rolldownDtsTask'
import {rollupTask} from './rollup/rollupTask'
import {rollupWatchTask} from './rollup/rollupWatchTask'
import type {BuildTaskHandlers, WatchTaskHandlers} from './types'

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
