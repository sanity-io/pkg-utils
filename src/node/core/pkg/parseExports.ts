import {existsSync} from 'node:fs'
import {resolve as resolvePath} from 'node:path'
import type {Logger} from '../../logger'
import type {StrictOptions} from '../../strict'
import {defaultEnding, fileEnding} from '../../tasks/dts/getTargetPaths'
import type {PkgExport} from '../config/types'
import {isRecord} from '../isRecord'
import {pkgExtMap} from './pkgExt'
import type {PackageJSON} from './types'
import {validateExports} from './validateExports'

/** @alpha */
export function parseExports(options: {
  cwd: string
  pkg: PackageJSON
  strict: boolean
  strictOptions: StrictOptions
  logger: Logger
}): (PkgExport & {_path: string})[] {
  const {cwd, pkg, strict, strictOptions, logger} = options
  const type = pkg.type || 'commonjs'
  const errors: string[] = []

  const report = (kind: 'warn' | 'error', message: string) => {
    if (kind === 'warn') {
      logger.warn(message)
    } else {
      errors.push(message)
    }
  }

  if (!pkg.main && strict && strictOptions.alwaysPackageJsonMain !== 'off') {
    report(strictOptions.alwaysPackageJsonMain, 'package.json: `main` must be declared')
  }

  if (!Array.isArray(pkg.files) && strict && strictOptions.alwaysPackageJsonFiles !== 'off') {
    report(
      strictOptions.alwaysPackageJsonFiles,
      'package.json: `files` should be used over `.npmignore`',
    )
  }

  if (pkg.source) {
    if (
      strict &&
      pkg.exports?.['.'] &&
      typeof pkg.exports['.'] === 'object' &&
      'source' in pkg.exports['.'] &&
      pkg.exports['.'].source === pkg.source
    ) {
      errors.push(
        'package.json: the "source" property can be removed, as it is equal to exports["."].source.',
      )
    } else if (!pkg.exports && pkg.main) {
      const extMap = pkgExtMap[type]
      const importExport = pkg.main.replace(fileEnding, extMap.esm)
      const requireExport = pkg.main.replace(fileEnding, extMap.commonjs)
      const defaultExport = pkg.main.replace(fileEnding, defaultEnding)

      const maybeBrowserCondition = []

      if (pkg.browser) {
        const browserConditions = []

        if (pkg.module && pkg.browser?.[pkg.module]) {
          browserConditions.push(
            `      "import": ${JSON.stringify(pkg.browser[pkg.module]!.replace(fileEnding, extMap.esm))}`,
          )
        } else if (pkg.browser?.[pkg.main]) {
          browserConditions.push(
            `      "import": ${JSON.stringify(pkg.browser[pkg.main]!.replace(fileEnding, extMap.esm))}`,
          )
        }

        if (pkg.browser?.[pkg.main]) {
          browserConditions.push(
            `      "require": ${JSON.stringify(pkg.browser[pkg.main]!.replace(fileEnding, extMap.commonjs))}`,
          )
        }

        if (browserConditions.length) {
          maybeBrowserCondition.push(
            `    "browser": {`,
            `      "source": ${JSON.stringify(pkg.browser?.[pkg.source] || pkg.source)},`,
            ...browserConditions,
            `    }`,
          )
        }
      }

      errors.push(
        ...([
          'package.json: `exports` are missing, it should be:',
          `"exports": {`,
          `  ".": {`,
          `    "source": ${JSON.stringify(pkg.source)},`,
          // If browser conditions are detected then add them to the suggestion
          ...(maybeBrowserCondition.length > 0 ? maybeBrowserCondition : []),
          type === 'commonjs' && `    "import": ${JSON.stringify(importExport)},`,
          type === 'module' && `    "require": ${JSON.stringify(requireExport)},`,
          `    "default": ${JSON.stringify(defaultExport)}`,
          `  },`,
          `  "./package.json": "./package.json"`,
          `}`,
        ].filter(Boolean) as string[]),
      )
    }
  }

  if (errors.length) {
    throw new Error('\n- ' + errors.join('\n- '))
  }

  if (!pkg.exports) {
    throw new Error(
      '\n- ' +
        [
          'package.json: `exports` are missing, please set a minimal configuration, for example:',
          `"exports": {`,
          `  ".": {`,
          `    "source": "./src/index.js",`,
          `    "default": "./dist/index.js"`,
          `  },`,
          `  "./package.json": "./package.json"`,
          `}`,
        ].join('\n- '),
    )
  }

  const _exports: (PkgExport & {_path: string})[] = []

  if (strict && strictOptions.noPackageJsonTypings !== 'off' && 'typings' in pkg) {
    report(strictOptions.noPackageJsonTypings, 'package.json: `typings` should be `types`')
  }

  if (
    strict &&
    strictOptions.alwaysPackageJsonTypes !== 'off' &&
    !pkg.types &&
    typeof pkg.exports?.['.'] === 'object' &&
    'source' in pkg.exports['.'] &&
    pkg.exports['.'].source?.endsWith('.ts')
  ) {
    report(
      strictOptions.alwaysPackageJsonTypes,
      'package.json: `types` must be declared for the npm listing to show as a TypeScript module.',
    )
  }

  if (strict && !pkg.exports['./package.json']) {
    errors.push('package.json: `exports["./package.json"] must be declared.')
  }

  for (const [exportPath, exportEntry] of Object.entries(pkg.exports)) {
    if (
      exportPath.endsWith('.json') ||
      (typeof exportEntry === 'string' && exportEntry.endsWith('.json'))
    ) {
      if (exportPath === './package.json') {
        if (exportEntry !== './package.json') {
          errors.push('package.json: `exports["./package.json"]` must be "./package.json".')
        }
      }
    } else if (exportPath.endsWith('.css')) {
      if (typeof exportEntry === 'string' && !existsSync(resolvePath(cwd, exportEntry))) {
        errors.push(
          `package.json: \`exports[${JSON.stringify(exportPath)}]\`: file does not exist.`,
        )
      } else if (typeof exportEntry !== 'string') {
        errors.push(
          `package.json: \`exports[${JSON.stringify(exportPath)}]\`: export conditions not supported for CSS files.`,
        )
      }
    } else if (isRecord(exportEntry) && 'svelte' in exportEntry) {
      // @TODO should we report a warning or a debug message here about a detected svelte export that is ignored?
    } else if (isPkgExport(exportEntry)) {
      const exp = {
        _exported: true,
        _path: exportPath,
        ...exportEntry,
      } satisfies PkgExport & {_path: string}

      // Infer the `default` condition based on the `type` and other conditions
      if (!exp.default) {
        const fallback = type === 'module' ? exp.import : exp.require

        if (fallback) {
          exp.default = fallback
        }
      }

      // Infer the `require` condition based on the `type` and other conditions
      if (!exp.require && type === 'commonjs' && exp.default) {
        exp.require = exp.default
      }

      // Infer the `import` condition based on the `type` and other conditions
      if (!exp.import && type === 'module' && exp.default) {
        exp.import = exp.default
      }

      if (exportPath === '.') {
        if (exportEntry.require && pkg.main && exportEntry.require !== pkg.main) {
          errors.push(
            'package.json: mismatch between "main" and "exports.require". These must be equal.',
          )
        }

        if (exportEntry.import && pkg.module && exportEntry.import !== pkg.module) {
          errors.push(
            'package.json: mismatch between "module" and "exports.import" These must be equal.',
          )
        }
      }

      _exports.push(exp)
    } else if (!isRecord(exportEntry)) {
      errors.push('package.json: exports must be an object')
    }
  }

  errors.push(...validateExports(_exports, {pkg}))

  if (errors.length) {
    throw new Error('\n- ' + errors.join('\n- '))
  }

  return _exports
}

function isPkgExport(value: unknown): value is PkgExport {
  return isRecord(value) && 'source' in value && typeof value['source'] === 'string'
}
