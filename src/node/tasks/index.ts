import {dtsTask, dtsWatchTask} from './dts'
import {rollupLegacyTask, rollupTask, rollupWatchTask} from './rollup'
import type {BuildTaskHandlers, WatchTaskHandlers} from './types'

export * from './dts'
export * from './rollup'
export * from './types'

/** @internal */
export const buildTaskHandlers: BuildTaskHandlers = {
  'build:dts': dtsTask,
  'build:js': rollupTask,
  'build:legacy': rollupLegacyTask,
}

/** @internal */
export const watchTaskHandlers: WatchTaskHandlers = {
  'watch:dts': dtsWatchTask,
  'watch:js': rollupWatchTask,
}
