/* eslint-disable no-console */

import path from 'path'
// import chalk from 'chalk'
import {rollup} from 'rollup'
import {PackageRuntime} from '../../../core'
import {_BuildContext} from '../../_types'
import {_resolveRollupConfig} from './_resolveRollupConfig'

export interface _RollupTaskEntry {
  path: string
  source: string
  output: string
}

/**
 * @internal
 */
export interface _RollupTask {
  type: 'rollup'
  buildId: string
  entries: _RollupTaskEntry[]
  runtime: PackageRuntime
  format: 'commonjs' | 'esm'
  target: string[]
}

export async function _rollupTask(ctx: _BuildContext, buildTask: _RollupTask): Promise<void> {
  const {files, dist: outDir} = ctx

  const {inputOptions, outputOptions} = _resolveRollupConfig(ctx, buildTask)

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
