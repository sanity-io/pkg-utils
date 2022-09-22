import {_isRecord} from '../_isRecord'
import {PkgExport} from '../config'
import {_PackageJSON} from './_types'
import {_validateExports} from './_validateExports'

/** @internal */
export function _parseExports(options: {pkg: _PackageJSON}): (PkgExport & {_path: string})[] {
  const {pkg} = options

  const rootExport: PkgExport & {_path: string} = {
    _exported: true,
    _path: '.',
    types: pkg.types,
    source: pkg.source || '',
    browser: pkg.browser && {
      require: pkg.main && pkg.browser[pkg.main],
      import: pkg.module && pkg.browser[pkg.module],
    },
    import: pkg.module,
    require: pkg.main,
    default: pkg.module || pkg.main || '',
  }

  const extraExports: (PkgExport & {_path: string})[] = []

  if (pkg.exports) {
    for (const [exportPath, exportEntry] of Object.entries(pkg.exports)) {
      if (_isRecord(exportEntry)) {
        if (exportPath === '.') {
          if (
            exportEntry.require &&
            rootExport.require &&
            exportEntry.require !== rootExport.require
          ) {
            throw new Error('mismatch between "main" and "require"')
          }

          if (exportEntry.import && rootExport.import && exportEntry.import !== rootExport.import) {
            throw new Error('mismatch between "module" and "import"')
          }

          if (exportEntry.types && rootExport.types && exportEntry.types !== rootExport.types) {
            throw new Error('mismatch between "types" and "types"')
          }

          if (exportEntry.source && rootExport.source && exportEntry.source !== rootExport.source) {
            throw new Error('mismatch between "source" and "source"')
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
        throw new Error('string entries are not supported')
      }
    }
  }

  const _exports = [rootExport, ...extraExports]

  return _validateExports(_exports, {pkg})
}
