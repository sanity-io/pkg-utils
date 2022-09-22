import {PkgExport} from '../config'
import {_PackageJSON} from './_types'

export function _validateExports(
  _exports: (PkgExport & {_path: string})[],
  options: {pkg: _PackageJSON}
): (PkgExport & {_path: string})[] {
  const {pkg} = options

  for (const exp of _exports) {
    if (pkg.type === 'commonjs') {
      if (exp.require && !exp.require.endsWith('.js')) {
        throw new Error(
          `package.json with \`"type": "commonjs"\` - \`exports["${exp._path}"].require\` must end with ".js"`
        )
      }
    }

    if (pkg.type === 'module') {
      if (exp.require && !exp.require.endsWith('.cjs')) {
        throw new Error(
          `package.json with \`"type": "module"\` - \`exports["${exp._path}"].require\` must end with ".cjs"`
        )
      }
    }
  }

  return _exports
}
