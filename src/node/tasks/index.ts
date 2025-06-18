import {dtsTask} from './dts/dtsTask'
import {dtsWatchTask} from './dts/dtsWatchTask'
import {rollupTask} from './rollup/rollupTask'
import {rollupWatchTask} from './rollup/rollupWatchTask'
import type {BuildTaskHandlers, WatchTaskHandlers} from './types'

export * from './dts'
export * from './rollup'
export * from './types'

/** @internal */
export const buildTaskHandlers: BuildTaskHandlers = {
  'build:dts': dtsTask,
  'build:js': rollupTask,
}

/** @internal */
export const watchTaskHandlers: WatchTaskHandlers = {
  'watch:dts': dtsWatchTask,
  'watch:js': rollupWatchTask,
}
