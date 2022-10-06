/* eslint-disable no-console */

import chalk from 'chalk'
import {ZodError} from 'zod'
import {_loadPkg} from './_loadPkg'
import {_PackageJSON} from './_types'

/** @internal */
export async function _loadPkgWithReporting(options: {cwd: string}): Promise<_PackageJSON> {
  try {
    return await _loadPkg(options)
  } catch (err) {
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        if (issue.code === 'invalid_type') {
          console.log(
            [
              `${chalk.red('fail')}   \`${_formatPath(issue.path)}\` `,
              `in ./package.json must be of type ${chalk.magenta(issue.expected)} `,
              `(received ${chalk.magenta(issue.received)})`,
            ].join('')
          )
        }
      }
    } else {
      console.error(err)
    }

    process.exit(1)
  }
}

function _formatPath(segments: Array<string | number>) {
  return segments
    .map((s, idx) => {
      if (idx === 0) return s

      if (typeof s === 'number') {
        return `[${s}]`
      }

      if (s.startsWith('.')) {
        return `["${s}"]`
      }

      return `.${s}`
    })
    .join('')
}
