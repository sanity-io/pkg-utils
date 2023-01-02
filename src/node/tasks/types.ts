import {RollupWatcherEvent} from 'rollup'
import {Observable} from 'rxjs'
import {PkgRuntime, BuildContext} from '../core'
import {DtsResult, DtsTask, DtsWatchTask} from './dts'

/** @internal */
export interface RollupTaskEntry {
  path: string
  source: string
  output: string
}

/** @internal */
export interface RollupTask {
  type: 'build:js'
  buildId: string
  entries: RollupTaskEntry[]
  runtime: PkgRuntime
  format: 'commonjs' | 'esm'
  target: string[]
}

/** @internal */
export interface RollupWatchTask {
  type: 'watch:js'
  buildId: string
  entries: RollupTaskEntry[]
  runtime: PkgRuntime
  format: 'commonjs' | 'esm'
  target: string[]
}

/** @internal */
export interface NodeReExportFromCJSTask {
  type: 'node:reexport-cjs'
  entries: {importId: string; import: string; require: string}[]
}

/** @internal */
export type BuildTask = DtsTask | RollupTask | NodeReExportFromCJSTask

/** @internal */
export type WatchTask = DtsWatchTask | RollupWatchTask

/** @internal */
export type TaskHandler<Task, Result = void> = {
  name: (ctx: BuildContext, task: Task) => string
  exec: (ctx: BuildContext, task: Task) => Observable<Result>
  complete: (ctx: BuildContext, task: Task, result: Result) => void
  error: (ctx: BuildContext, task: Task, error: unknown) => void
}

/** @internal */
export interface BuildTaskHandlers {
  'build:dts': TaskHandler<DtsTask, DtsResult>
  'build:js': TaskHandler<RollupTask>
  'node:reexport-cjs': TaskHandler<NodeReExportFromCJSTask>
}

/** @internal */
export interface WatchTaskHandlers {
  'watch:dts': TaskHandler<DtsWatchTask, DtsResult>
  'watch:js': TaskHandler<RollupWatchTask, RollupWatcherEvent>
}
