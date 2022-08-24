/* eslint-disable no-console */

import path from 'path'
import {promisify} from 'util'
import chalk from 'chalk'
import rimrafCallback from 'rimraf'
import {_BuildContext} from '../../_types'
import {_buildTypes} from './_buildTypes'
import {_extractTypes} from './_extractTypes'

const rimraf = promisify(rimrafCallback)

/**
 * @internal
 */
export interface _DtsTask {
  type: 'dts'
  exportId: string
  exportPath: string
  source: string
  output: string
}

/**
 * @internal
 */
export async function _dtsTask(ctx: _BuildContext, task: _DtsTask): Promise<void> {
  const {cwd, dist, files, tsconfig} = ctx
  const exportPath = task.exportPath === '.' ? './index' : task.exportPath

  console.log('=================================================================================')
  console.log(chalk.gray('task      '), 'd.ts')
  console.log(chalk.gray('source    '), path.join('', task.source))
  console.log(chalk.gray('export    '), path.join(dist, `${exportPath}.d.ts`))

  const distPath = path.resolve(cwd, dist)
  const tmpPath = path.resolve(cwd, dist, 'tmp')

  const tsconfigPath = path.resolve(cwd, tsconfig || 'tsconfig.json')

  const types = await _buildTypes({
    cwd,
    outDir: tmpPath,
    sourcePath: task.source,
    tsconfigPath,
  })

  await _extractTypes({
    cwd,
    exportPath,
    files,
    projectPath: cwd,
    sourcePath: types.path,
    tsconfigPath,
    distPath,
  })

  // Delete tmp directory
  await rimraf(tmpPath)
}
