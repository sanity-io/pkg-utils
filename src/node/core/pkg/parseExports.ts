import {legacyEnding} from '../../tasks/dts/getTargetPaths'
import type {PkgExport} from '../config'
import {isRecord} from '../isRecord'
import type {PackageJSON} from './types'
import {validateExports} from './validateExports'

/** @internal */
export function parseExports(options: {
  pkg: PackageJSON
  strict: boolean
  legacyExports: boolean
}): (PkgExport & {_path: string})[] {
  const {pkg, strict, legacyExports} = options

  const rootExport: PkgExport & {_path: string} = {
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

  const extraExports: (PkgExport & {_path: string})[] = []

  const errors: string[] = []

  // @TODO validate typesVersions when legacyExports is true

  if (strict && 'typings' in pkg) {
    errors.push('package.json: `typings` should be `types`')
  }

  if (pkg.exports) {
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
        if (exportPath === '.') {
          if (
            exportEntry.require &&
            rootExport.require &&
            exportEntry.require !== rootExport.require
          ) {
            errors.push(
              'package.json: mismatch between "main" and "exports.require". These must be equal.',
            )
          }

          if (legacyExports) {
            const indexLegacyExport = (
              exportEntry.browser?.import ||
              exportEntry.import ||
              exportEntry.browser?.require ||
              exportEntry.require ||
              ''
            ).replace(/(\.esm)?\.[mc]?js$/, legacyEnding)

            if (indexLegacyExport !== rootExport.import) {
              errors.push(
                `package.json: "module" should be "${indexLegacyExport}" when "legacyExports" is true`,
              )
            }
          } else {
            if (
              exportEntry.import &&
              rootExport.import &&
              exportEntry.import !== rootExport.import
            ) {
              errors.push(
                'package.json: mismatch between "module" and "exports.import" These must be equal.',
              )
            }
          }

          if (exportEntry.source && rootExport.source && exportEntry.source !== rootExport.source) {
            errors.push(
              'package.json: mismatch between "source" and "exports.source". These must be equal.',
            )
          }

          Object.assign(rootExport, exportEntry)
        } else {
          const extraExport: PkgExport & {_path: string} = {
            _exported: true,
            _path: exportPath,
            ...exportEntry,
          }

          extraExports.push(extraExport)
        }
      } else {
        errors.push('package.json: exports must be an object')
      }
    }
  }

  const _exports = [rootExport, ...extraExports]

  errors.push(...validateExports(_exports, {pkg}))

  if (errors.length) {
    throw new Error('\n- ' + errors.join('\n- '))
  }

  return _exports
}
