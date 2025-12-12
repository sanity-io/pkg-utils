import {ZodError, type PackageJSON} from '@sanity/parse-package-json'
import chalk from 'chalk'
import type {Logger} from '../../logger.ts'
import type {StrictOptions} from '../../strict.ts'
import {assertLast, assertOrder} from './helpers.ts'
import {loadPkg} from './loadPkg.ts'

/** @alpha */
export async function loadPkgWithReporting(options: {
  pkgPath: string
  logger: Logger
  strict: boolean
  strictOptions: StrictOptions
}): Promise<PackageJSON> {
  const {pkgPath, logger, strict, strictOptions} = options

  try {
    const pkg = await loadPkg({pkgPath})
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

        if (exp.development && exp.source && exp.development !== exp.source) {
          shouldError = true
          logger.error(
            `exports["${expPath}"]: the \`development\` condition must have the same value as \`source\` when both are present. Expected "${exp.source}" but got "${exp.development}"`,
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

    // validate publishConfig.exports
    if (strict && pkg.exports && Object.keys(pkg.exports).length > 0) {
      // Check if exports contains source or development conditions
      const hasSourceOrDevelopment = Object.entries(pkg.exports).some(([, exp]) => {
        if (typeof exp === 'string') return false
        if (typeof exp === 'object' && 'svelte' in exp) return false
        return Boolean(exp.source || exp.development)
      })

      if (hasSourceOrDevelopment) {
        if (!pkg.publishConfig?.exports) {
          const msg =
            'package.json: `publishConfig.exports` is missing. Adding it helps avoid publishing to npm with the `source` or `development` condition that points to code that cannot be used by the resolver. ' +
            'See https://tsdown.dev/options/package-exports#conditional-dev-exports for more information.'
          if (strictOptions.noPublishConfigExports === 'error') {
            shouldError = true
            logger.error(msg)
          } else if (strictOptions.noPublishConfigExports !== 'off') {
            logger.warn(msg)
          }
        } else {
          // Validate publishConfig.exports structure
          const publishExports = pkg.publishConfig.exports

          // Check that all keys in exports exist in publishConfig.exports
          for (const exportPath of Object.keys(pkg.exports)) {
            if (!(exportPath in publishExports)) {
              shouldError = true
              logger.error(
                `publishConfig.exports: missing export path "${exportPath}" that exists in exports`,
              )
            }
          }

          // Check that all keys in publishConfig.exports exist in exports
          for (const exportPath of Object.keys(publishExports)) {
            if (!(exportPath in pkg.exports)) {
              shouldError = true
              logger.error(
                `publishConfig.exports: unexpected export path "${exportPath}" that does not exist in exports`,
              )
            }
          }

          // Validate each export path
          for (const [exportPath, exp] of Object.entries(pkg.exports)) {
            if (typeof exp === 'string' || 'svelte' in exp) {
              // For string or svelte exports, publishConfig should match
              const publishExp = publishExports[exportPath]
              if (
                typeof publishExp !== 'string' &&
                (typeof publishExp !== 'object' || !('svelte' in publishExp))
              ) {
                shouldError = true
                logger.error(
                  `publishConfig.exports["${exportPath}"]: should be a string matching exports["${exportPath}"]`,
                )
              }
              continue
            }

            const publishExp = publishExports[exportPath]
            if (typeof publishExp === 'string') {
              // publishConfig has a string, validate it's correct
              // It should be a condensed form when only default remains after removing source/development
              const conditions = Object.keys(exp).filter(
                (k) => k !== 'source' && k !== 'development',
              )
              if (conditions.length !== 1 || conditions[0] !== 'default') {
                shouldError = true
                logger.error(
                  `publishConfig.exports["${exportPath}"]: is a string but exports["${exportPath}"] has multiple conditions besides source/development: ${conditions.join(', ')}`,
                )
              }
              continue
            }

            if ('svelte' in publishExp) {
              continue
            }

            // Validate conditions
            const exportConditions = Object.keys(exp).filter(
              (k) => k !== 'source' && k !== 'development',
            )
            const publishConditions = Object.keys(publishExp)

            // Check for source or development in publishConfig
            if ('source' in publishExp) {
              shouldError = true
              logger.error(
                `publishConfig.exports["${exportPath}"]: should not contain the \`source\` condition`,
              )
            }

            if ('development' in publishExp) {
              shouldError = true
              logger.error(
                `publishConfig.exports["${exportPath}"]: should not contain the \`development\` condition`,
              )
            }

            // Check that all conditions match (except source/development)
            for (const condition of exportConditions) {
              if (!(condition in publishExp)) {
                shouldError = true
                logger.error(
                  `publishConfig.exports["${exportPath}"]: missing \`${condition}\` condition that exists in exports["${exportPath}"]`,
                )
              }
            }

            for (const condition of publishConditions) {
              if (!exportConditions.includes(condition)) {
                shouldError = true
                logger.error(
                  `publishConfig.exports["${exportPath}"]: unexpected \`${condition}\` condition that does not exist in exports["${exportPath}"]`,
                )
              }
            }
          }
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
