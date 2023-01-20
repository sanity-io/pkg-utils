import {PkgExport} from '../config'
import {isRecord} from '../isRecord'
import {PkgExtMap} from './pkgExt'
import {PackageJSON} from './types'
import {validateExports} from './validateExports'

/** @internal */
export function parseExports(options: {
  extMap: PkgExtMap
  pkg: PackageJSON
  strict: boolean
}): (PkgExport & {_path: string})[] {
  const {extMap, pkg, strict} = options

  const rootExport: PkgExport & {_path: string} = {
    _exported: true,
    _path: '.',
    types: pkg.types,
    source: pkg.source || '',
    browser: pkg.browser && {
      source: pkg.source || '',
      require: pkg.main && pkg.browser[pkg.main],
      import: pkg.module && pkg.browser[pkg.module],
    },
    require: pkg.main,
    import: pkg.module,
    default: pkg.module || pkg.main || '',
  }

  const extraExports: (PkgExport & {_path: string})[] = []

  const errors: string[] = []

  if (pkg.exports) {
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
      } else if (isRecord(exportEntry)) {
        if (exportPath === '.') {
          if (
            exportEntry.require &&
            rootExport.require &&
            exportEntry.require !== rootExport.require
          ) {
            errors.push(
              'package.json: mismatch between "main" and "exports.require". These must be equal.'
            )
          }

          if (exportEntry.import && rootExport.import && exportEntry.import !== rootExport.import) {
            errors.push(
              'package.json: mismatch between "module" and "exports.import" These must be equal.'
            )
          }

          if (exportEntry.types && rootExport.types && exportEntry.types !== rootExport.types) {
            errors.push(
              'package.json: mismatch between "types" and "exports.types". These must be equal.'
            )
          }

          if (exportEntry.source && rootExport.source && exportEntry.source !== rootExport.source) {
            errors.push(
              'package.json: mismatch between "source" and "exports.source". These must be equal.'
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

  errors.push(...validateExports(_exports, {extMap, pkg}))

  if (errors.length) {
    throw new Error('\n- ' + errors.join('\n- '))
  }

  return _exports
}
