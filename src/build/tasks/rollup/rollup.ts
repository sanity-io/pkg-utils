/* eslint-disable no-console */

import path from 'path'
import chalk from 'chalk'
import {rollup} from 'rollup'
import {PackageSubPathExportEntry} from '../../../core'
import {_BuildContext} from '../../_types'
import {_resolveRollupConfig} from './_resolveRollupConfig'

/**
 * @internal
 */
export interface _RollupTask {
  type: 'rollup'
  buildId: string
  entries: (PackageSubPathExportEntry & {path: string})[]
  runtime: 'node' | 'web'
  format: 'commonjs' | 'esm'
  target: string[]
}

export async function _rollupTask(ctx: _BuildContext, buildTask: _RollupTask): Promise<void> {
  console.log('=================================================================================')

  console.log(chalk.gray('task      '), 'rollup')
  console.log(chalk.gray('target    '), buildTask.target.join(', '))
  console.log(chalk.gray('format    '), buildTask.format)

  const {cwd, files, dist: outDir, pkg} = ctx

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

  for (const entry of buildTask.entries) {
    console.log(`- ${path.join(pkg.name, entry.path)}`)

    console.log(chalk.gray('  source  '), path.relative(cwd, path.resolve(cwd, entry.source)))

    const defaultFile = files.find(
      (f) => entry.default && f.path === path.resolve(cwd, entry.default)
    )

    const requireFile = files.find(
      (f) => entry.require && f.path === path.resolve(cwd, entry.require)
    )

    const typesFile = files.find((f) => entry.types && f.path === path.resolve(cwd, entry.types))

    if (buildTask.format.includes('esm'))
      console.log(
        chalk.gray('  default '),
        defaultFile ? path.relative(cwd, defaultFile.path) : undefined
      )

    if (buildTask.format.includes('commonjs'))
      console.log(
        chalk.gray('  require '),
        requireFile ? path.relative(cwd, requireFile.path) : undefined
      )

    if (entry.types)
      console.log(
        chalk.gray('  types   '),
        typesFile ? path.relative(cwd, typesFile.path) : undefined
      )
  }
}
