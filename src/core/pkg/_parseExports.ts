import {_isRecord} from '../_isRecord'
import {PackageSubPathExportEntry} from '../config'
import {_PackageJSON} from './_types'

/**
 * @internal
 */
export function _parseExports(pkg: _PackageJSON): (PackageSubPathExportEntry & {path: string})[] {
  const rootExport: PackageSubPathExportEntry & {path: string} = {
    path: '.',
    runtime: 'web',

    source: pkg.source || 'index.js',
    require: pkg.main,
    default: pkg.module,
    types: pkg.types,
  }

  const extraExports: (PackageSubPathExportEntry & {path: string})[] = []

  if (pkg.exports) {
    for (const [exportPath, exportEntry] of Object.entries(pkg.exports)) {
      if (_isRecord(exportEntry)) {
        if (exportPath === '.') {
          Object.assign(rootExport, exportEntry)
        } else {
          extraExports.push({
            path: exportPath,
            runtime: 'web',
            source: exportEntry.source,
            ...exportEntry,
          })
        }
      } else {
        throw new Error('string entries are not supported')
      }
    }
  }

  return [rootExport, ...extraExports]
}
