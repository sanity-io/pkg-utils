/* eslint-disable no-console */

import path from 'path'
import chalk from 'chalk'
import {
  PackageExports,
  _DEFAULTS,
  _loadConfig,
  _loadPkg,
  _parseExports,
  _resolveConfigProperty,
} from '../core'
import {_parseBrowserslistVersions} from './_parseBrowserslistVersions'
import {_parseNodeTarget} from './_parseNodeTarget'
import {_parseTasks} from './_parseTasks'
import {_parseWebTarget} from './_parseWebTarget'
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

  const parsedExports = _parseExports(pkg).reduce<PackageExports>((acc, x) => {
    const {path: exportPath, ...exportEntry} = x

    return {...acc, [exportPath]: exportEntry}
  }, {})

  const exports = _resolveConfigProperty(config?.exports, parsedExports)

  const parsedExternal = [
    ...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
    ...(pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
  ]

  const external = _resolveConfigProperty(config?.external, parsedExternal)

  const targetVersions = _parseBrowserslistVersions(pkg.browserslist || _DEFAULTS.browserslist)

  const srcPath = path.resolve(cwd, config?.src || 'src')
  const distPath = path.resolve(cwd, config?.dist || 'dist')

  const nodeTarget = _parseNodeTarget(targetVersions)
  const webTarget = _parseWebTarget(targetVersions)

  if (!nodeTarget) {
    throw new Error('no matching `node` target')
  }

  if (!webTarget) {
    throw new Error('no matching `web` target')
  }

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
    target: {node: nodeTarget, web: webTarget},
    tsconfig,
  }

  console.log(chalk.gray('cwd       '), context.cwd)
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
