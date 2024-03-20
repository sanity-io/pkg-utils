import chalk from 'chalk'
import {Observable} from 'rxjs'

import {printExtractMessages} from '../../printExtractMessages'
import type {TaskHandler} from '../types'
import {doExtract} from './doExtract'
import {DtsError} from './DtsError'
import type {DtsResult, DtsWatchTask} from './types'

/** @internal */
export const dtsWatchTask: TaskHandler<DtsWatchTask, DtsResult> = {
  name: (_ctx, task) =>
    [
      `build type definitions`,
      ...task.entries.map((entry) => {
        return entry.targetPaths.map((targetPath) => {
          return [
            `    - ${chalk.cyan(entry.importId)}: `,
            `${chalk.yellow(entry.sourcePath)} ${chalk.gray('→')} ${chalk.yellow(targetPath)}`,
          ].join('')
        })
      }),
    ].join('\n'),
  exec: (ctx, task) => {
    return new Observable((observer) => {
      doExtract(ctx, task)
        .then((result) => {
          observer.next(result)
          observer.complete()
        })
        .catch((err) => observer.error(err))
    })
  },
  complete: (ctx, _task, result) => {
    const {logger} = ctx

    printExtractMessages(ctx, result.messages)

    logger.warn('watching typescript definitions is currently not supported')
    logger.log()
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
