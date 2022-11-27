import chalk from 'chalk'
import {Observable} from 'rxjs'
import {_printExtractMessages} from '../../_printExtractMessages'
import {_TaskHandler} from '../_types'
import {_doExtract} from './_doExtract'
import {_DtsError} from './_DtsError'
import {_DtsResult, _DtsTask} from './_types'

/** @internal */
export const _dtsTask: _TaskHandler<_DtsTask, _DtsResult> = {
  name: (_ctx, task) =>
    [
      `build type definitions`,
      ...task.entries.map(
        (entry) =>
          `       ${chalk.blue(entry.importId)}: ${entry.sourcePath} -> ${entry.targetPath}`
      ),
    ].join('\n'),
  exec: (ctx, task) => {
    return new Observable((observer) => {
      _doExtract(ctx, task)
        .then((result) => {
          observer.next(result)
          observer.complete()
        })
        .catch((err) => {
          observer.error(err)
        })
    })
  },
  complete: (ctx, _task, result) => {
    _printExtractMessages(ctx, result.messages)
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
