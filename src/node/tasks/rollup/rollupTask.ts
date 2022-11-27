/* eslint-disable no-console */

import path from 'path'
import chalk from 'chalk'
import {rollup} from 'rollup'
import {Observable} from 'rxjs'
import {_BuildContext} from '../../_core'
import {_RollupTask, _TaskHandler} from '../_types'
import {_resolveRollupConfig} from './_resolveRollupConfig'

/** @internal */
export const _rollupTask: _TaskHandler<_RollupTask> = {
  name: (ctx, task) =>
    `build javascript files (target ${task.target.join(' + ')}, format ${
      task.format
    })\n       ${task.entries
      .map((e) => `${chalk.blue(path.join(ctx.pkg.name, e.path))}: ${e.source} -> ${e.output}`)
      .join('\n       ')}`,
  exec: (ctx, task) => {
    return new Observable((observer) => {
      _execPromise(ctx, task)
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

async function _execPromise(ctx: _BuildContext, task: _RollupTask) {
  const {files, distPath} = ctx
  const outDir = path.relative(ctx.cwd, distPath)

  const {inputOptions, outputOptions} = _resolveRollupConfig(ctx, task)

  // Create bundle
  const bundle = await rollup(inputOptions)

  // an array of file names this bundle depends on
  // console.log(bundle.watchFiles)

  // generate output specific code in-memory
  // you can call this function multiple times on the same bundle object
  const {output} = await bundle.generate(outputOptions)

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
