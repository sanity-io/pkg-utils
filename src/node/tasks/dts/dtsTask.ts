import chalk from 'chalk'
import {Observable} from 'rxjs'

import {printExtractMessages} from '../../printExtractMessages'
import {TaskHandler} from '../types'
import {doExtract} from './doExtract'
import {DtsError} from './DtsError'
import {DtsResult, DtsTask} from './types'

/** @internal */
export const dtsTask: TaskHandler<DtsTask, DtsResult> = {
  name: (_ctx, task) =>
    [
      `Build type definitions...`,
      `  entries:`,
      ...task.entries.map((entry) =>
        [
          `    - ${chalk.cyan(entry.importId)}: `,
          `${chalk.yellow(entry.sourcePath)} ${chalk.gray('→')} ${chalk.yellow(entry.targetPath)}`,
        ].join(''),
      ),
    ].join('\n'),
  exec: (ctx, task) => {
    return new Observable((observer) => {
      doExtract(ctx, task)
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
    printExtractMessages(ctx, result.messages)
  },
  error: (ctx, _task, err) => {
    const {logger} = ctx

    if (err instanceof DtsError) {
      printExtractMessages(ctx, err.messages)
    } else if (err instanceof Error) {
      logger.error(err)
    }
  },
}
