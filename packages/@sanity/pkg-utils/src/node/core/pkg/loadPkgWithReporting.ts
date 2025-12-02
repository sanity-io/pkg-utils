import chalk from 'chalk'
import {ZodError} from 'zod/v3'
import type {Logger} from '../../logger.ts'
import type {StrictOptions} from '../../strict.ts'
import {assertLast, assertOrder} from './helpers.ts'
import {loadPkg} from './loadPkg.ts'
import type {PackageJSON} from './types.ts'

/** @alpha */
export async function loadPkgWithReporting(options: {
  cwd: string
  logger: Logger
  strict: boolean
  strictOptions: StrictOptions
}): Promise<PackageJSON> {
  const {cwd, logger, strict, strictOptions} = options

  try {
    const pkg = await loadPkg({cwd})
    let shouldError = false

    if (strict) {
      // Check for missing or commonjs type field
      if (strictOptions.preferModuleType !== 'off') {
        if (!pkg.type) {
          const msg =
            'package.json: `type` field is missing. Future versions of pkg-utils will require `"type": "module"`. Consider adding `"type": "module"` to prepare for this change.'
          if (strictOptions.preferModuleType === 'error') {
            shouldError = true
            logger.error(msg)
          } else {
            logger.warn(msg)
          }
        } else if (pkg.type === 'commonjs') {
          const msg =
            'package.json: `type` is set to "commonjs". Future versions of pkg-utils will require `"type": "module"`. Consider migrating to ES modules to prepare for this change.'
          if (strictOptions.preferModuleType === 'error') {
            shouldError = true
            logger.error(msg)
          } else {
            logger.warn(msg)
          }
        }
      }

      // Check for banned root-level fields
      if (strictOptions.noPackageJsonMain !== 'off' && pkg.main) {
        const msg =
          'package.json: the `main` field is no longer needed. All modern versions of Node.js and bundlers support the `exports` field. Remove the `main` field and use `exports` instead.'
        if (strictOptions.noPackageJsonMain === 'error') {
          shouldError = true
          logger.error(msg)
        } else {
          logger.warn(msg)
        }
      }

      if (strictOptions.noPackageJsonBrowser !== 'off' && pkg.browser) {
        const msg =
          'package.json: the `browser` field is no longer needed. Use the `browser` condition in `exports` instead for better support across modern bundlers.'
        if (strictOptions.noPackageJsonBrowser === 'error') {
          shouldError = true
          logger.error(msg)
        } else {
          logger.warn(msg)
        }
      }

      if (strictOptions.noPackageJsonTypesVersions !== 'off' && pkg.typesVersions) {
        const msg =
          'package.json: the `typesVersions` field is no longer needed. TypeScript has long supported conditional exports and the `types` condition. Remove the `typesVersions` field and use the `types` condition in `exports` instead.'
        if (strictOptions.noPackageJsonTypesVersions === 'error') {
          shouldError = true
          logger.error(msg)
        } else {
          logger.warn(msg)
        }
      }
    }

    // validate exports
    if (pkg.exports) {
      const _exports = Object.entries(pkg.exports)

      for (const [expPath, exp] of _exports) {
        if (typeof exp === 'string' || 'svelte' in exp) {
          continue
        }

        const keys = Object.keys(exp)

        if (exp.types) {
          shouldError = true
          logger.error(
            `exports["${expPath}"]: the \`types\` condition shouldn't be used as dts files are generated in such a way that both CJS and ESM is supported`,
          )
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
