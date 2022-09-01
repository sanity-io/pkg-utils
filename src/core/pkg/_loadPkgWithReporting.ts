/* eslint-disable no-console */

import chalk from 'chalk'
import {ZodError} from 'zod'
import {_loadPkg} from './_loadPkg'
import {_PackageJSON} from './_types'

export async function _loadPkgWithReporting(options: {cwd: string}): Promise<_PackageJSON> {
  try {
    return await _loadPkg(options)
  } catch (err) {
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        if (issue.code === 'invalid_type') {
          console.log(
            `${chalk.red('invalid type')} in ./package.json at ${chalk.magenta(
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
