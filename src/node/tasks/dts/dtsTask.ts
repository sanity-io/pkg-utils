import chalk from 'chalk'
import {from, Observable} from 'rxjs'
import {printExtractMessages} from '../../printExtractMessages'
import {resolveRollupConfig} from '../rollup/resolveRollupConfig'
import type {TaskHandler} from '../types'
import {doExtract} from './doExtract'
import {DtsError} from './DtsError'
import type {DtsResult, DtsTask} from './types'

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
    if (ctx.dts === 'rolldown') {
      /**
       * Based on the `tsdown` implementation:
       * https://github.com/rolldown/tsdown/blob/0978c68bd505c76d7e3097572cd652f81c23f97e/src/index.ts#L138-L141
       */
      const doRolldownExtract = async (): Promise<DtsResult> => {
        const [{build: rolldownBuild}, {dts: dtsPlugin}] = await Promise.all([
          import('rolldown'),
          import('rolldown-plugin-dts'),
        ])

        const {inputOptions, outputOptions} = resolveRollupConfig(ctx, {
          type: 'build:js',
          buildId: 'dts',
        })
        // const {output} = await rolldownBuild(buildOptions)
      }
      return from(doRolldownExtract())
    }
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
