import {defaultEnding, fileEnding, legacyEnding} from '../../tasks/dts/getTargetPaths'
import type {PkgExport} from '../config'
import {isRecord} from '../isRecord'
import {pkgExtMap} from './pkgExt'
import type {PackageJSON} from './types'
import {validateExports} from './validateExports'

/** @internal */
export function parseExports(options: {
  pkg: PackageJSON
  strict: boolean
  legacyExports: boolean
}): (PkgExport & {_path: string})[] {
  const {pkg, strict, legacyExports} = options
  const type = pkg.type || 'commonjs'
  const errors: string[] = []

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
            `      "import": ${JSON.stringify(pkg.browser[pkg.module].replace(fileEnding, extMap.esm))}`,
          )
        } else if (pkg.browser?.[pkg.main]) {
          browserConditions.push(
            `      "import": ${JSON.stringify(pkg.browser?.[pkg.main].replace(fileEnding, extMap.esm))}`,
          )
        } else if (legacyExports) {
          const browserImport = pkg.main.replace(fileEnding, `.browser${extMap.esm}`)

          browserConditions.push(`      "import": ${JSON.stringify(browserImport)}`)
        }

        if (pkg.browser?.[pkg.main]) {
          browserConditions.push(
            `      "require": ${JSON.stringify(pkg.browser[pkg.main].replace(fileEnding, extMap.commonjs))}`,
          )
        } else if (legacyExports) {
          const browserRequire = pkg.main.replace(fileEnding, `.browser${extMap.commonjs}`)

          browserConditions.push(`      "require": ${JSON.stringify(browserRequire)}`)
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
          // If legacy exports are enabled we suggest the full list of exports, if not we can use the terse version
          (legacyExports || type === 'commonjs') &&
            `    "import": ${JSON.stringify(importExport)},`,
          (legacyExports || type === 'module') &&
            `    "require": ${JSON.stringify(requireExport)},`,
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

  /*
  const rootExports: PkgExport & {_path: string} = {
    _exported: true,
    _path: '.',
    source: pkg.source || '',
    browser: pkg.browser && {
      source: pkg.source || '',
      require: pkg.main && pkg.browser[pkg.main],
      import: pkg.module && pkg.browser[pkg.module],
    },
    require: legacyExports
      ? pkg.main
      : typeof pkg.exports?.['.'] === 'object' && 'require' in pkg.exports['.']
        ? pkg.exports['.'].require
        : '',
    import: legacyExports
      ? pkg.module
      : typeof pkg.exports?.['.'] === 'object' && 'import' in pkg.exports['.']
        ? pkg.exports['.'].import
        : '',
    default: legacyExports
      ? pkg.module || pkg.main || ''
      : typeof pkg.exports?.['.'] === 'object' && 'default' in pkg.exports['.']
        ? pkg.exports['.'].default || ''
        : pkg.module || pkg.main || '',
  }
  // */

  const _exports: (PkgExport & {_path: string})[] = []

  // @TODO validate typesVersions when legacyExports is true

  if (strict && 'typings' in pkg) {
    errors.push('package.json: `typings` should be `types`')
  }

  if (strict && !pkg.types && pkg.source?.endsWith('.ts')) {
    errors.push(
      'package.json: `types` must be declared for the npm listing to show as a TypeScript module.',
    )
  }

  if (strict && !pkg.exports['./package.json']) {
    errors.push('package.json: `exports["./package.json"] must be declared.')
  }

  for (const [exportPath, exportEntry] of Object.entries(pkg.exports)) {
    if (exportPath.endsWith('.json')) {
      if (exportPath === './package.json') {
        if (exportEntry !== './package.json') {
          errors.push('package.json: `exports["./package.json"] must be "./package.json".')
        }
      }
    } else if (isRecord(exportEntry) && 'svelte' in exportEntry) {
      // @TODO should we report a warning or a debug message here about a detected svelte export that is ignored?
    } else if (isRecord(exportEntry)) {
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

        if (legacyExports) {
          if (fallback) {
            errors.push(
              `package.json - \`exports["${exp._path}"].default\` should be set to "${fallback}" when "legacyExports" is true`,
            )
          } else {
            errors.push(
              `package.json - \`exports["${exp._path}"].default\` should be specified when "legacyExports" is true`,
            )
          }
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

        if (legacyExports) {
          const indexLegacyExport = (exportEntry.import || exportEntry.require || '').replace(
            /(\.esm)?\.[mc]?js$/,
            legacyEnding,
          )

          if (indexLegacyExport !== pkg.module) {
            errors.push(
              `package.json: "module" should be "${indexLegacyExport}" when "legacyExports" is true`,
            )
          }
        } else {
          if (exportEntry.import && pkg.module && exportEntry.import !== pkg.module) {
            errors.push(
              'package.json: mismatch between "module" and "exports.import" These must be equal.',
            )
          }
        }
      }

      _exports.push(exp)
    } else {
      errors.push('package.json: exports must be an object')
    }
  }

  errors.push(...validateExports(_exports, {pkg}))

  if (errors.length) {
    throw new Error('\n- ' + errors.join('\n- '))
  }

  return _exports
}
