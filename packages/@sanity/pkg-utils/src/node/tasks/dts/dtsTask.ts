import chalk from 'chalk'
import {from} from 'rxjs'
import {printExtractMessages} from '../../printExtractMessages.ts'
import type {TaskHandler} from '../types.ts'
import {doExtract} from './doExtract.ts'
import {DtsError} from './DtsError.ts'
import type {DtsResult, DtsTask} from './types.ts'

/** @internal */
export const dtsTask: TaskHandler<DtsTask, DtsResult> = {
  name: (ctx, task) =>
    [
      `Build type definitions with ${chalk.bold(ctx.dts)}...`,
      '  entries:',
      ...task.entries.map((entry) => {
        return entry.targetPaths
          .map((targetPath) => {
            return [
              `    - ${chalk.cyan(entry.importId)}: `,
              `${chalk.yellow(entry.sourcePath)} ${chalk.gray('→')} ${chalk.yellow(targetPath)}`,
            ].join('')
          })
          .join('\n')
      }),
    ].join('\n'),
  exec: (ctx, task) => {
    return from(doExtract(ctx, task))
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
