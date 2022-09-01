import {_isRecord} from '../_isRecord'
import {PackageExport} from '../config'
import {_PackageJSON} from './_types'

/**
 * @internal
 */
export function _parseExports(options: {pkg: _PackageJSON}): (PackageExport & {_path: string})[] {
  const {pkg} = options

  const rootExport: PackageExport & {_path: string} = {
    _exported: true,
    _path: '.',
    browser: pkg.browser && {
      require: pkg.main && pkg.browser[pkg.main],
      import: pkg.module && pkg.browser[pkg.module],
    },
    source: pkg.source || 'index.js',
    require: pkg.main,
    import: pkg.module,
    types: pkg.types,
  }

  const extraExports: (PackageExport & {_path: string})[] = []

  if (pkg.exports) {
    for (const [exportPath, exportEntry] of Object.entries(pkg.exports)) {
      if (_isRecord(exportEntry)) {
        if (exportPath === '.') {
          Object.assign(rootExport, exportEntry)
        } else {
          const extraExport: PackageExport & {_path: string} = {
            _exported: true,
            _path: exportPath,
            ...exportEntry,
          }

          extraExports.push(extraExport)
        }
      } else {
        throw new Error('string entries are not supported')
      }
    }
  }

  return [rootExport, ...extraExports]
}
