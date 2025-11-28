import {tsdownTask} from './tsdown/tsdownTask.ts'
import {tsdownWatchTask} from './tsdown/tsdownWatchTask.ts'
import type {BuildTaskHandlers, WatchTaskHandlers} from './types.ts'

/** @internal */
export const buildTaskHandlers: BuildTaskHandlers = {
  'build:tsdown': tsdownTask,
}

/** @internal */
export const watchTaskHandlers: WatchTaskHandlers = {
  'watch:tsdown': tsdownWatchTask,
}
