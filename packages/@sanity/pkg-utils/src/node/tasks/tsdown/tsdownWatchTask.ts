import path from 'node:path'
import chalk from 'chalk'
import {Observable} from 'rxjs'
import {createConsoleSpy} from '../../consoleSpy.ts'
import type {BuildContext} from '../../core/contexts/buildContext.ts'
import type {TaskHandler, TsdownWatchTask} from '../types.ts'
import {resolveTsdownConfig} from './resolveTsdownConfig.ts'

/** @internal */
export const tsdownWatchTask: TaskHandler<TsdownWatchTask> = {
  name: (ctx, task) => {
    const bundleEntries = task.entries.filter((e) => e.path.includes('__$$bundle_'))
    const entries = task.entries.filter((e) => !e.path.includes('__$$bundle_'))

    const targetLines = task.target.length
      ? [`  target:`, ...task.target.map((t) => `    - ${chalk.yellow(t)}`)]
      : []

    const bundlesLines = bundleEntries.length
      ? [
          '  bundles:',
          ...bundleEntries.map((e) =>
            [
              `    - `,
              `${chalk.yellow(e.source)} ${chalk.gray('→')} ${chalk.yellow(e.output)}`,
            ].join(''),
          ),
        ]
      : []

    const entriesLines = entries.length
      ? [
          '  entries:',
          ...entries.map((e) =>
            [
              `    - `,
              `${chalk.cyan(path.join(ctx.pkg.name, e.path))}: `,
              `${chalk.yellow(e.source)} ${chalk.gray('→')} ${chalk.yellow(e.output)}`,
            ].join(''),
          ),
        ]
      : []

    return [
      `Watch with ${chalk.bold('tsdown')}...`,
      `  format: ${chalk.yellow(task.format)}`,
      ...targetLines,
      ...bundlesLines,
      ...entriesLines,
    ].join('\n')
  },
  exec: (ctx, task) => {
    return new Observable((subscriber) => {
      void execWatch(ctx, task, subscriber)

      // Clean up function
      return () => {
        // tsdown will handle cleanup
      }
    })
  },
  complete: () => {
    //
  },
  error: (_ctx, _task, err) => {
    console.error(err)
  },
}

async function execWatch(
  ctx: BuildContext,
  task: TsdownWatchTask,
  subscriber: {next: (value: any) => void; error: (err: any) => void},
) {
  const {build} = await import('tsdown')
  const {logger} = ctx

  // Prevent tsdown from printing directly to the console
  const consoleSpy = createConsoleSpy({
    onRestored: (messages) => {
      for (const msg of messages) {
        const text = String(msg.args[0])

        if (msg.code === 'CIRCULAR_DEPENDENCY') {
          continue // ignore
        }

        if (text.startsWith('Dynamic import can only')) {
          continue // ignore
        }

        if (text.startsWith('Sourcemap is likely to be incorrect')) {
          continue // ignore
        }

        if (msg.type === 'log') {
          logger.info(...msg.args)
        }

        if (msg.type === 'warn') {
          logger.warn(...msg.args)
        }

        if (msg.type === 'error') {
          logger.error(...msg.args)
        }
      }
    },
  })

  try {
    const options = await resolveTsdownConfig(ctx, task)

    // Enable watch mode
    const watchOptions = {
      ...options,
      watch: true,
    }

    // Build with tsdown in watch mode
    await build(watchOptions)

    // Notify subscriber that watch is set up
    subscriber.next({event: 'START'})

    // Keep the observable alive
    // tsdown will continue to watch and rebuild

    // Restore console
    consoleSpy.restore()
  } catch (err) {
    // Restore console
    consoleSpy.restore()
    subscriber.error(err)
  }
}
