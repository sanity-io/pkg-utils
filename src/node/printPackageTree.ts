import path from 'node:path'

import chalk from 'chalk'
import treeify from 'treeify'

import type {BuildContext, PkgExport} from './core'
import {fileExists} from './fileExists'
import {getFilesize} from './getFilesize'

function getFileInfo(cwd: string, filePath: string) {
  const p = path.resolve(cwd, filePath)
  const exists = fileExists(p)
  const size = exists ? getFilesize(p) : undefined

  return {exists, size}
}

export function printPackageTree(ctx: BuildContext): void {
  const {cwd, exports, logger, pkg} = ctx

  if (!exports) return

  logger.log(`${chalk.blue(pkg.name)}@${chalk.green(pkg.version)}`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tree: Record<string, unknown> = {}

  if (pkg.type) {
    tree['type'] = chalk.yellow(pkg.type)
  }

  if (pkg.bin) {
    tree['bin'] = Object.fromEntries(
      Object.entries(pkg.bin).map(([name, file]) => [chalk.cyan(name), fileInfo(file)]),
    )
  }

  function fileInfo(file: string) {
    const info = getFileInfo(cwd, file)

    if (!info.size) {
      return `${chalk.gray(file)} ${chalk.red('does not exist')}`
    }

    return `${chalk.yellow(file)} ${chalk.gray(info.size)}`
  }

  tree['exports'] = Object.fromEntries(
    Object.entries(exports)
      .filter(([, entry]) => entry._exported)
      .map(([exportPath, entry]) => {
        const exp: Omit<PkgExport, '_exported'> = {
          source: fileInfo(entry.source),
          browser: undefined,
          require: undefined,
          node: undefined,
          import: undefined,
          default: fileInfo(entry.default),
        }

        if (entry.browser) {
          exp.browser = {source: fileInfo(entry.browser.source)}

          if (entry.browser.import) exp.browser.import = fileInfo(entry.browser.import)
          if (entry.browser.require) exp.browser.require = fileInfo(entry.browser.require)
        } else {
          delete exp.browser
        }

        if (entry.require) {
          exp.require = fileInfo(entry.require)
        } else {
          delete exp.require
        }

        if (entry.node) {
          exp.node = {}

          if (entry.node.source) exp.node.source = fileInfo(entry.node.source)
          if (entry.node.import) exp.node.import = fileInfo(entry.node.import)
          if (entry.node.require) exp.node.require = fileInfo(entry.node.require)
        } else {
          delete exp.node
        }

        if (entry.import) {
          exp.import = fileInfo(entry.import)
        } else {
          delete exp.import
        }

        return [chalk.cyan(path.join(pkg.name, exportPath)), exp]
      }),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger.log(treeify.asTree(tree as Record<string, any>, true, true))
}
