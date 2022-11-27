import {PkgExport} from '../config'
import {MODULE_EXT} from '../constants'
import {PackageJSON} from './types'

export function validateExports(
  _exports: (PkgExport & {_path: string})[],
  options: {pkg: PackageJSON}
): string[] {
  const {pkg} = options
  const ext = MODULE_EXT[pkg.type]

  const errors: string[] = []

  for (const exp of _exports) {
    if (exp.require && !exp.require.endsWith(ext.commonjs)) {
      errors.push(
        `package.json with \`type: "${pkg.type}"\` - \`exports["${exp._path}"].require\` must end with "${ext.commonjs}"`
      )
    }

    if (exp.import && !exp.import.endsWith(ext.esm)) {
      errors.push(
        `package.json with \`type: "${pkg.type}"\` - \`exports["${exp._path}"].import\` must end with "${ext.esm}"`
      )
    }
  }

  return errors
}
