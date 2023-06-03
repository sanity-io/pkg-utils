import {dtsTask, dtsWatchTask} from './dts'
import {nodeReexportCjsTask} from './node/reexportCjsTask'
import {rollupTask, rollupWatchTask} from './rollup'
import {BuildTaskHandlers, WatchTaskHandlers} from './types'

export * from './dts'
export * from './rollup'
export * from './types'

/** @internal */
export const buildTaskHandlers: BuildTaskHandlers = {
  'build:dts': dtsTask,
  'build:js': rollupTask,
  'node:reexport-cjs': nodeReexportCjsTask,
}

/** @internal */
export const watchTaskHandlers: WatchTaskHandlers = {
  'watch:dts': dtsWatchTask,
  'watch:js': rollupWatchTask,
}
