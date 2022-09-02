import {_BuildTaskHandlers, _WatchTaskHandlers} from './_types'
import {_dtsTask, _dtsWatchTask} from './dts'
import {_rollupTask, _rollupWatchTask} from './rollup'

export * from './_types'
export * from './dts'
export * from './rollup'

/** @internal */
export const _buildTaskHandlers: _BuildTaskHandlers = {
  'build:dts': _dtsTask,
  'build:js': _rollupTask,
}

/** @internal */
export const _watchTaskHandlers: _WatchTaskHandlers = {
  'watch:dts': _dtsWatchTask,
  'watch:js': _rollupWatchTask,
}
