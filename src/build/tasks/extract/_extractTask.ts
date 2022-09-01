/* eslint-disable no-console */

import fs from 'fs/promises'
import path from 'path'
import {extract, transform} from '@sanity/tsdoc-to-portable-text'
// import chalk from 'chalk'
import mkdirp from 'mkdirp'
import {_BuildContext} from '../../_types'

/**
 * @internal
 */
export interface _ExtractTask {
  type: 'extract'
  mainEntryPointPath: string
}

export async function _extractTask(ctx: _BuildContext, _task: _ExtractTask): Promise<void> {
  // const {mainEntryPointPath} = task

  // console.log('=================================================================================')
  // console.log(chalk.gray('task      '), 'extract')
  // console.log(
  //   chalk.gray('source    '),
  //   path.relative(ctx.cwd, path.resolve(ctx.cwd, mainEntryPointPath))
  // )

  const extracted = await extract(ctx.cwd, {
    tsconfigPath: path.resolve(ctx.cwd, ctx.tsconfig || 'tsconfig.json'),
  })

  const transformed = transform(extracted, {
    package: {
      version: ctx.pkg.version,
    },
  })

  const apiJsonDirPath = path.resolve(ctx.cwd, 'etc/api', ctx.pkg.name)

  await mkdirp(apiJsonDirPath)

  const jsonPath = path.resolve(apiJsonDirPath, `${ctx.pkg.version}.json`)

  if (transformed.length) {
    await fs.writeFile(jsonPath, JSON.stringify(transformed, null, 2) + '\n')

    // console.log(chalk.gray('result    '), path.relative(ctx.cwd, jsonPath))
  }
}
