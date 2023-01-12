import chalk from 'chalk'
import {ZodError} from 'zod'
import {Logger} from '../../logger'
import {assertFirst, assertLast, assertOrder} from './helpers'
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

    // validate exports
    if (pkg.exports) {
      const _exports = Object.entries(pkg.exports)

      for (const [expPath, exp] of _exports) {
        if (typeof exp === 'string') {
          continue
        }

        const keys = Object.keys(exp)

        if (!assertFirst('types', keys)) {
          logger.warn(`exports["${expPath}"]: the \`types\` property should be the first property`)
        }

        if (!assertOrder('require', 'import', keys)) {
          logger.warn(
            `exports["${expPath}"]: the \`require\` property should come before the \`import\` property`
          )
        }

        if (!assertOrder('require', 'node', keys)) {
          logger.warn(
            `exports["${expPath}"]: the \`require\` property should come before the \`node\` property`
          )
        }

        if (!assertOrder('node', 'import', keys)) {
          logger.warn(
            `exports["${expPath}"]: the \`node\` property should come before \`import\` property`
          )
        }

        if (!assertLast('default', keys)) {
          logger.warn(`exports["${expPath}"]: the \`default\` property should be the last property`)
        }
      }
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
