import chalk from 'chalk'
import {ZodError} from 'zod'
import {Logger} from '../../logger'
import {loadPkg} from './loadPkg'
import {PackageJSON} from './types'

/** @internal */
export async function loadPkgWithReporting(options: {
  cwd: string
  logger: Logger
}): Promise<PackageJSON> {
  const {cwd, logger} = options

  try {
    const pkg = await loadPkg({cwd})

    if (pkg.type === undefined) {
      logger.warn('no "type" field in package.json, defaulting to "commonjs"')
    }

    return pkg
  } catch (err) {
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        if (issue.code === 'invalid_type') {
          logger.error(
            [
              `\`${formatPath(issue.path)}\` `,
              `in \`./package.json\` must be of type ${chalk.magenta(issue.expected)} `,
              `(received ${chalk.magenta(issue.received)})`,
            ].join('')
          )
          continue
        }

        logger.error(issue)
      }
    } else {
      logger.error(err)
    }

    process.exit(1)
  }
}

function formatPath(segments: Array<string | number>) {
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
