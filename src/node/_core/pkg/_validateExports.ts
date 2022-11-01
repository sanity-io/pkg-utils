import {_MODULE_EXT} from '../_constants'
import {PkgExport} from '../config'
import {_PackageJSON} from './_types'

export function _validateExports(
  _exports: (PkgExport & {_path: string})[],
  options: {pkg: _PackageJSON}
): (PkgExport & {_path: string})[] {
  const {pkg} = options
  const ext = _MODULE_EXT[pkg.type]

  for (const exp of _exports) {
    if (exp.require && !exp.require.endsWith(ext.commonjs)) {
      throw new Error(
        `package.json with \`type: "${pkg.type}"\` - \`exports["${exp._path}"].require\` must end with "${ext.commonjs}"`
      )
    }

    if (exp.import && !exp.import.endsWith(ext.esm)) {
      throw new Error(
        `package.json with \`type: "${pkg.type}"\` - \`exports["${exp._path}"].import\` must end with "${ext.esm}"`
      )
    }
  }

  return _exports
}
