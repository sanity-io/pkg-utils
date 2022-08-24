/* eslint-disable no-console */

import path from 'path'
import chalk from 'chalk'
import {PackageExports, _loadConfig, _loadPkg, _parseExports, _resolveConfigProperty} from '../core'
import {_parseTasks} from './_parseTasks'
import {_BuildContext} from './_types'
import {_dtsTask, _extractTask, _rollupTask} from './tasks'

/**
 * @public
 */
export async function build(options: {
  cwd: string
  extract?: boolean
  tsconfig?: string
}): Promise<void> {
  const {cwd, extract = false, tsconfig = 'tsconfig.json'} = options
  const pkg = await _loadPkg({cwd})
  const config = await _loadConfig({cwd})

  // if (!config) {
  //   console.log('no configuration found')
  //   return
  // }

  const parsedExports = _parseExports(pkg).reduce<PackageExports>((acc, x) => {
    const {path: exportPath, ...exportEntry} = x

    return {...acc, [exportPath]: exportEntry}
  }, {})

  const exports = config?.exports
    ? _resolveConfigProperty(config.exports, parsedExports)
    : parsedExports

  const initialExternal = [
    ...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
    ...(pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
  ]

  const external = config?.external
    ? _resolveConfigProperty(config.external, initialExternal)
    : initialExternal

  const srcPath = path.resolve(cwd, config?.src || 'src')
  const distPath = path.resolve(cwd, config?.dist || 'dist')

  const context: _BuildContext = {
    config,
    cwd,
    exports,
    extract,
    files: [],
    external,
    dist: path.relative(cwd, distPath),
    pkg,
    src: path.relative(cwd, srcPath),
    tsconfig,
  }

  console.log(chalk.gray('cwd       '), context.cwd)
  // console.log('external ', context.external)
  console.log(chalk.gray('src       '), context.src)
  console.log(chalk.gray('dist      '), context.dist)
  console.log(chalk.gray('tsconfig  '), context.tsconfig)

  if (exports) {
    const buildTasks = _parseTasks(context)

    for (const task of buildTasks) {
      if (task.type === 'dts') {
        await _dtsTask(context, task)
      }

      if (task.type === 'extract') {
        await _extractTask(context, task)
      }

      if (task.type === 'rollup') {
        await _rollupTask(context, task)
      }
    }
  } else {
    throw new Error('no exports')
  }
}
