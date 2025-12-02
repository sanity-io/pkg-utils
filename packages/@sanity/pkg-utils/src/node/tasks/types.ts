import type {Observable} from 'rxjs'
import type {PkgRuntime} from '../core/config/types.ts'
import type {BuildContext} from '../core/contexts/buildContext.ts'

/** @internal */
export interface TsdownTaskEntry {
  path: string
  source: string
  output: string
}

/** @internal */
export interface TsdownTask {
  type: 'build:tsdown'
  buildId: string
  entries: TsdownTaskEntry[]
  runtime: PkgRuntime
  format: 'commonjs' | 'esm'
  target: string[]
}

/** @internal */
export interface TsdownWatchTask {
  type: 'watch:tsdown'
  buildId: string
  entries: TsdownTaskEntry[]
  runtime: PkgRuntime
  format: 'commonjs' | 'esm'
  target: string[]
}

/** @internal */
export type BuildTask = TsdownTask

/** @internal */
export type WatchTask = TsdownWatchTask

/** @internal */
export type TaskHandler<Task, Result = void> = {
  name: (ctx: BuildContext, task: Task) => string
  exec: (ctx: BuildContext, task: Task) => Observable<Result>
  complete: (ctx: BuildContext, task: Task, result: Result) => void
  error: (ctx: BuildContext, task: Task, error: unknown) => void
}

/** @internal */
export interface BuildTaskHandlers {
  'build:tsdown': TaskHandler<TsdownTask>
}

/** @internal */
export interface WatchTaskHandlers {
  'watch:tsdown': TaskHandler<TsdownWatchTask>
}
