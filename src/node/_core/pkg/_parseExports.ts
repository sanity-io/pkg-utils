import {_isRecord} from '../_isRecord'
import {PkgExport} from '../config'
import {_PackageJSON} from './_types'

/** @internal */
export function _parseExports(options: {pkg: _PackageJSON}): (PkgExport & {_path: string})[] {
  const {pkg} = options

  const rootExport: PkgExport & {_path: string} = {
    _exported: true,
    _path: '.',
    types: pkg.types,
    source: pkg.source || 'index.js',
    browser: pkg.browser && {
      require: pkg.main && pkg.browser[pkg.main],
      import: pkg.module && pkg.browser[pkg.module],
    },
    import: pkg.module,
    require: pkg.main,
    default: pkg.module || pkg.main || './index.js',
  }

  const extraExports: (PkgExport & {_path: string})[] = []

  if (pkg.exports) {
    for (const [exportPath, exportEntry] of Object.entries(pkg.exports)) {
      if (_isRecord(exportEntry)) {
        if (exportPath === '.') {
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
        throw new Error('string entries are not supported')
      }
    }
  }

  return [rootExport, ...extraExports]
}
