/* eslint-disable no-console */

import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'
import prettyBytes from 'pretty-bytes'
import treeify from 'treeify'
import {ZodError} from 'zod'
import {
  PackageExport,
  PackageExports,
  PackageRuntime,
  _DEFAULTS,
  _loadConfig,
  _loadPkg,
  _parseExports,
  _resolveConfigProperty,
} from '../core'
import {_parseBrowserslistVersions} from './_parseBrowserslistVersions'
import {_parseBrowserTarget} from './_parseBrowserTarget'
import {_parseNodeTarget} from './_parseNodeTarget'
import {_parseTasks} from './_parseTasks'
import {_BuildContext} from './_types'
import {_dtsTask, _extractTask, _rollupTask} from './tasks'

async function _withZodReporting<T>(fn: () => Promise<T>) {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        if (issue.code === 'invalid_type') {
          console.log(
            `${chalk.red('invalid type')} at ${chalk.magenta(
              `\`${issue.path.join('')}\``
            )} (expected ${issue.expected}, received ${issue.received})`
          )
        }
      }
    } else {
      console.error(err)
    }

    process.exit(1)
  }
}

/**
 * @public
 */
export async function build(options: {
  cwd: string
  extract?: boolean
  tsconfig?: string
}): Promise<void> {
  const {cwd, extract = false, tsconfig = 'tsconfig.json'} = options

  const pkg = await _withZodReporting(() => _loadPkg({cwd}))
  const config = await _loadConfig({cwd})

  const targetVersions = _parseBrowserslistVersions(pkg.browserslist || _DEFAULTS.browserslist)

  const srcPath = path.resolve(cwd, config?.src || 'src')
  const distPath = path.resolve(cwd, config?.dist || 'dist')

  const nodeTarget = _parseNodeTarget(targetVersions)
  const webTarget = _parseBrowserTarget(targetVersions)

  if (!nodeTarget) {
    throw new Error('no matching `node` target')
  }

  if (!webTarget) {
    throw new Error('no matching `web` target')
  }

  // const target: {node: string[]; web: string[]} = {
  //   node: nodeTarget,
  //   web: webTarget,
  // }

  const target: Record<PackageRuntime, string[]> = {
    '*': webTarget.concat(nodeTarget),
    browser: webTarget,
    node: nodeTarget,
  }

  // const defaultRuntime = config?.runtime || 'browser'

  const parsedExports = _parseExports({pkg}).reduce<PackageExports>((acc, x) => {
    const {_path: exportPath, ...exportEntry} = x

    return {...acc, [exportPath]: exportEntry}
  }, {})

  const exports = _resolveConfigProperty(config?.exports, parsedExports)

  const parsedExternal = [
    ...(pkg.dependencies ? Object.keys(pkg.dependencies) : []),
    ...(pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : []),
  ]

  const external = _resolveConfigProperty(config?.external, parsedExternal)

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
    runtime: config?.runtime || '*',
    target,
    tsconfig,
  }

  function _filesize(file: string) {
    const stats = fs.statSync(path.resolve(cwd, file))

    return prettyBytes(stats.size)
  }

  function _spinner(msg: string) {
    const startTime = Date.now()
    const spinner = ora(`${chalk.yellow('run ')} ${msg}`)

    spinner.color = 'yellow'
    spinner.start()

    return () => {
      spinner.color = 'green'
      spinner.succeed(`${chalk.green('ok  ')} ${msg} ${chalk.gray(`${Date.now() - startTime}ms`)}`)
    }
  }

  if (exports) {
    const buildTasks = _parseTasks(context)

    console.log('')

    for (const task of buildTasks) {
      if (task.type === 'dts') {
        const succeed = _spinner(`generate type definitions`)

        await _dtsTask(context, task)

        succeed()
      }

      if (task.type === 'extract') {
        const succeed = _spinner(`extract API reference`)

        await _extractTask(context, task)

        succeed()
      }

      if (task.type === 'rollup') {
        const succeed = _spinner(`rollup (${task.buildId})`)

        await _rollupTask(context, task)

        succeed()
      }
    }

    console.log('')
    console.log(`${chalk.blue(pkg.name)}@${chalk.green(pkg.version)}`)

    const tree: Record<string, any> = {}

    if (pkg.bin) {
      tree.bin = pkg.bin
    }

    tree.exports = Object.fromEntries(
      Object.entries(exports)
        .filter(([, entry]) => entry._exported)
        .map(([exportPath, entry]) => {
          const exp: Omit<PackageExport, '_exported'> = {source: entry.source}

          if (entry.browser) {
            exp.browser = {}

            if (entry.browser.require) {
              exp.browser.require = `${entry.browser.require} ${chalk.gray(
                _filesize(entry.browser.require)
              )}`
            }

            if (entry.browser.import) {
              exp.browser.import = `${entry.browser.import} ${chalk.gray(
                _filesize(entry.browser.import)
              )}`
            }
          }

          if (entry.import) exp.import = `${entry.import} ${chalk.gray(_filesize(entry.import))}`
          if (entry.require)
            exp.require = `${entry.require} ${chalk.gray(_filesize(entry.require))}`
          if (entry.types) exp.types = `${entry.types} ${chalk.gray(_filesize(entry.types))}`

          return [chalk.green(path.join(pkg.name, exportPath)), exp]
        })
    )

    console.log(treeify.asTree(tree, true, true))
  } else {
    throw new Error('no exports')
  }
}
