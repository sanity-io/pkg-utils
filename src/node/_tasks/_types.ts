import {RollupWatcherEvent} from 'rollup'
import {Observable} from 'rxjs'
import {PkgRuntime, _BuildContext} from '../_core'
import {_DtsResult, _DtsTask, _DtsWatchTask} from './dts'

/** @internal */
export interface _RollupTaskEntry {
  path: string
  source: string
  output: string
}

/** @internal */
export interface _RollupTask {
  type: 'build:js'
  buildId: string
  entries: _RollupTaskEntry[]
  runtime: PkgRuntime
  format: 'commonjs' | 'esm'
  target: string[]
}

/** @internal */
export interface _RollupWatchTask {
  type: 'watch:js'
  buildId: string
  entries: _RollupTaskEntry[]
  runtime: PkgRuntime
  format: 'commonjs' | 'esm'
  target: string[]
}

/** @internal */
export type _BuildTask = _DtsTask | _RollupTask

/** @internal */
export type _WatchTask = _DtsWatchTask | _RollupWatchTask

/** @internal */
export type _TaskHandler<Task, Result = void> = {
  name: (ctx: _BuildContext, task: Task) => string
  exec: (ctx: _BuildContext, task: Task) => Observable<Result>
  complete: (ctx: _BuildContext, task: Task, result: Result) => void
  error: (ctx: _BuildContext, task: Task, error: unknown) => void
}

/** @internal */
export interface _BuildTaskHandlers {
  'build:dts': _TaskHandler<_DtsTask, _DtsResult>
  'build:js': _TaskHandler<_RollupTask>
}

/** @internal */
export interface _WatchTaskHandlers {
  'watch:dts': _TaskHandler<_DtsWatchTask, _DtsResult>
  'watch:js': _TaskHandler<_RollupWatchTask, RollupWatcherEvent>
}
