import chalk from 'chalk'
import {Observable} from 'rxjs'
import {_printExtractMessages} from '../../_printExtractMessages'
import {_TaskHandler} from '../_types'
import {_doExtract} from './_doExtract'
import {_DtsError} from './_DtsError'
import {_DtsResult, _DtsWatchTask} from './_types'

/** @internal */
export const _dtsWatchTask: _TaskHandler<_DtsWatchTask, _DtsResult> = {
  name: (_ctx, task) =>
    [
      `build type definitions`,
      `       ${chalk.blue(task.importId)}: ${task.sourcePath} -> ${task.targetPath}`,
    ].join('\n'),
  exec: (ctx, task) => {
    return new Observable((observer) => {
      _doExtract(ctx, task)
        .then((result) => {
          observer.next(result)
          observer.complete()
        })
        .catch((err) => observer.error(err))
    })
  },
  complete: (ctx, _task, result) => {
    const {logger} = ctx

    _printExtractMessages(ctx, result.messages)

    logger.warn('watching typescript definitions is currently not supported')
    logger.log()
  },
  error: (ctx, _task, err) => {
    const {logger} = ctx

    if (err instanceof _DtsError) {
      _printExtractMessages(ctx, err.messages)
    } else if (err instanceof Error) {
      logger.error(err)
    }
  },
}
