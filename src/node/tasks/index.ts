import {dtsTask, dtsWatchTask} from './dts'
import {rollupTask, rollupWatchTask} from './rollup'
import {BuildTaskHandlers, WatchTaskHandlers} from './types'

export * from './types'
export * from './dts'
export * from './rollup'

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
