import path from 'path'
import chalk from 'chalk'
import {RollupWatcherEvent, RollupWatchOptions, watch as rollupWatch} from 'rollup'
import {Observable} from 'rxjs'
import {_RollupWatchTask, _TaskHandler} from '../_types'
import {_resolveRollupConfig} from './_resolveRollupConfig'

/** @internal */
export const _rollupWatchTask: _TaskHandler<_RollupWatchTask, RollupWatcherEvent> = {
  name: (ctx, task) =>
    `build javascript files (target ${task.target.join(' + ')}, format ${
      task.format
    })\n       ${task.entries
      .map((e) => `${chalk.blue(path.join(ctx.pkg.name, e.path))}: ${e.source} -> ${e.output}`)
      .join('\n       ')}`,
  exec: (ctx, task) => {
    const {inputOptions, outputOptions} = _resolveRollupConfig(ctx, task)

    return new Observable((observer) => {
      const watchOptions: RollupWatchOptions = {
        ...inputOptions,
        output: outputOptions,
      }

      const watcher = rollupWatch(watchOptions)

      watcher.on('event', (event) => {
        observer.next(event)
      })

      return () => {
        watcher.close()
      }
    })
  },
  complete: (ctx, task, event) => {
    const {logger} = ctx

    if (event.code === 'BUNDLE_END') {
      logger.success(
        `build javascript files (target ${task.target.join(' + ')}, format ${
          task.format
        })\n       ${task.entries
          .map((e) => `${chalk.blue(path.join(ctx.pkg.name, e.path))}: ${e.source} -> ${e.output}`)
          .join('\n       ')}`
      )
      logger.log('')

      return
    }

    if (event.code === 'BUNDLE_START') {
      return
    }

    if (event.code === 'END') {
      return
    }

    if (event.code === 'ERROR') {
      // logger.log('')
      logger.error(event.code, event)

      return
    }

    if (event.code === 'START') {
      return
    }
  },
  error: (ctx, _task, err) => {
    const {logger} = ctx

    if (err instanceof Error) {
      logger.log(err)
    }
  },
}
