/* eslint-disable no-console */

import path from 'path'
import chalk from 'chalk'
import {rollup} from 'rollup'
import {Observable} from 'rxjs'
import {BuildContext} from '../../core'
import {RollupTask, TaskHandler} from '../types'
import {resolveRollupConfig} from './resolveRollupConfig'

/** @internal */
export const rollupTask: TaskHandler<RollupTask> = {
  name: (ctx, task) =>
    [
      `Build javascript files...`,
      `  format: ${chalk.yellow(task.format)}`,
      `  target:`,
      ...task.target.map((t) => `    - ${chalk.yellow(t)}`),
      `  entries:`,
      ...task.entries.map((e) =>
        [
          `    - `,
          `${chalk.cyan(path.join(ctx.pkg.name, e.path))}: `,
          `${chalk.yellow(e.source)} ${chalk.gray('→')} ${chalk.yellow(e.output)}`,
        ].join('')
      ),
    ].join('\n'),
  exec: (ctx, task) => {
    return new Observable((observer) => {
      execPromise(ctx, task)
        .then((result) => {
          observer.next(result)
          observer.complete()
        })
        .catch((err) => observer.error(err))
    })
  },
  complete: () => {
    //
  },
  error: (_ctx, _task, err) => {
    if (err instanceof Error) {
      console.log(err)
    }
  },
}

function createSpyConsole() {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  }

  const messages: {type: 'log' | 'warn' | 'error'; args: unknown[]}[] = []

  console.log = (...args: unknown[]) => messages.push({type: 'log', args})
  console.warn = (...args: unknown[]) => messages.push({type: 'warn', args})
  console.error = (...args: unknown[]) => messages.push({type: 'error', args})

  return {
    messages,
    restore: () => {
      console.log = original.log
      console.warn = original.warn
      console.error = original.error
    },
  }
}

async function execPromise(ctx: BuildContext, task: RollupTask) {
  const {distPath, files, logger} = ctx
  const outDir = path.relative(ctx.cwd, distPath)

  // Prevent rollup from printing warnings to the console
  const spyConsole = createSpyConsole()

  const {inputOptions, outputOptions} = resolveRollupConfig(ctx, task)

  // Create bundle
  const bundle = await rollup({
    ...inputOptions,
    onwarn(warning) {
      spyConsole.messages.push({type: 'warn', args: [warning.message]})
    },
  })

  // generate output specific code in-memory
  // you can call this function multiple times on the same bundle object
  const {output} = await bundle.generate(outputOptions)

  // Restore console
  spyConsole.restore()

  for (const msg of spyConsole.messages) {
    const text = String(msg.args[0])

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

  for (const chunkOrAsset of output) {
    if (chunkOrAsset.type === 'asset') {
      files.push({
        type: 'asset',
        path: path.resolve(outDir, chunkOrAsset.fileName),
      })
    } else {
      files.push({
        type: 'chunk',
        path: path.resolve(outDir, chunkOrAsset.fileName),
      })
    }
  }

  // or write the bundle to disk
  await bundle.write(outputOptions)

  // closes the bundle
  await bundle.close()
}
