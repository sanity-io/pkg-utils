import chalk from 'chalk'
import {ZodError} from 'zod'

import {assertFirst, assertLast, assertOrder} from './helpers'
import type {Logger} from '../../logger'
import {loadPkg} from './loadPkg'
import type {PackageJSON} from './types'

/** @internal */
export async function loadPkgWithReporting(options: {
  cwd: string
  logger: Logger
}): Promise<PackageJSON> {
  const {cwd, logger} = options

  try {
    const pkg = await loadPkg({cwd})
    let shouldError = false

    // validate exports
    if (pkg.exports) {
      const _exports = Object.entries(pkg.exports)

      for (const [expPath, exp] of _exports) {
        if (typeof exp === 'string' || 'svelte' in exp) {
          continue
        }

        const keys = Object.keys(exp)

        if (!assertFirst('types', keys)) {
          shouldError = true
          logger.error(`exports["${expPath}"]: the \`types\` property should be the first property`)
        }

        if (exp.module) {
          shouldError = true
          logger.error(
            `exports["${expPath}"]: the \`module\` condition shouldn't be used as it's not well supported in all bundlers.`,
          )
        }

        if (exp.node) {
          if (exp.import && exp.node.import && !assertOrder('node', 'import', keys)) {
            shouldError = true
            logger.error(
              `exports["${expPath}"]: the \`node\` property should come before the \`import\` property`,
            )
          }

          if (exp.node.module) {
            shouldError = true
            logger.error(
              `exports["${expPath}"]: the \`node.module\` condition shouldn't be used as it's not well supported in all bundlers. A better strategy is to refactor the codebase to no longer be vulnerable to the "dual package hazard"`,
            )
          }

          if (
            !exp.node.source &&
            exp.node.import &&
            (exp.node.require || exp.require) &&
            (exp.node.import.endsWith('.cjs.js') || exp.node.import.endsWith('.cjs.mjs'))
          ) {
            shouldError = true
            logger.error(
              `exports["${expPath}"]: the \`node.import\` re-export pattern shouldn't be used as it's not well supported in all bundlers. A better strategy is to refactor the codebase to no longer be vulnerable to the "dual package hazard"`,
            )
          }

          if (exp.require && exp.node.require && exp.require === exp.node.require) {
            shouldError = true
            logger.error(
              `exports["${expPath}"]: the \`node.require\` property isn't necessary as it's identical to \`require\``,
            )
          } else if (exp.require && exp.node.require && !assertOrder('node', 'require', keys)) {
            shouldError = true
            logger.error(
              `exports["${expPath}"]: the \`node\` property should come before the \`require\` property`,
            )
          }
        } else {
          if (!assertOrder('import', 'require', keys)) {
            logger.warn(
              `exports["${expPath}"]: the \`import\` property should come before the \`require\` property`,
            )
          }
        }

        if (!assertLast('default', keys)) {
          shouldError = true
          logger.error(
            `exports["${expPath}"]: the \`default\` property should be the last property`,
          )
        }
      }
    }

    if (shouldError) {
      process.exit(1)
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
            ].join(''),
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
