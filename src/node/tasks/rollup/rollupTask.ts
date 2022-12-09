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
    `build javascript files (target ${task.target.join(' + ')}, format ${
      task.format
    })\n       ${task.entries
      .map((e) => `${chalk.blue(path.join(ctx.pkg.name, e.path))}: ${e.source} -> ${e.output}`)
      .join('\n       ')}`,
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

async function execPromise(ctx: BuildContext, task: RollupTask) {
  const {files, distPath} = ctx
  const outDir = path.relative(ctx.cwd, distPath)

  const _console = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  }

  const {inputOptions, outputOptions} = resolveRollupConfig(ctx, task)

  console.log = () => undefined
  console.warn = () => undefined
  console.error = () => undefined

  // Create bundle
  const bundle = await rollup({
    ...inputOptions,
    onwarn(warning) {
      if (!warning.code || !['CIRCULAR_DEPENDENCY'].includes(warning.code)) {
        // rollupWarn(warning)
        _console.warn.bind(console)(chalk.yellow('warn  '), warning.message)
      }
    },
  })

  // generate output specific code in-memory
  // you can call this function multiple times on the same bundle object
  const {output} = await bundle.generate(outputOptions)

  console.log = _console.log
  console.warn = _console.warn
  console.error = _console.error

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
