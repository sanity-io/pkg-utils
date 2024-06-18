import {dtsTask, dtsWatchTask} from './dts'
import {rollupLegacyTask, rollupReactCompilerTask, rollupTask, rollupWatchTask} from './rollup'
import type {BuildTaskHandlers, WatchTaskHandlers} from './types'

export * from './dts'
export * from './rollup'
export * from './types'

/** @internal */
export const buildTaskHandlers: BuildTaskHandlers = {
  'build:dts': dtsTask,
  'build:js': rollupTask,
  'build:legacy': rollupLegacyTask,
  'build:react-compiler': rollupReactCompilerTask,
}

/** @internal */
export const watchTaskHandlers: WatchTaskHandlers = {
  'watch:dts': dtsWatchTask,
  'watch:js': rollupWatchTask,
}
