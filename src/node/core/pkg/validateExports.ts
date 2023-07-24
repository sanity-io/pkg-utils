import {PkgExport} from '../config'
import {PkgExtMap} from './pkgExt'
import {PackageJSON} from './types'

export function validateExports(
  _exports: (PkgExport & {_path: string})[],
  options: {extMap: PkgExtMap; pkg: PackageJSON},
): string[] {
  const {extMap, pkg} = options
  const ext = extMap[pkg.type || 'commonjs']

  const errors: string[] = []

  for (const exp of _exports) {
    if (exp.require && !exp.require.endsWith(ext.commonjs)) {
      errors.push(
        `package.json with \`type: "${pkg.type}"\` - \`exports["${exp._path}"].require\` must end with "${ext.commonjs}"`,
      )
    }

    if (exp.import && !exp.import.endsWith(ext.esm)) {
      errors.push(
        `package.json with \`type: "${pkg.type}"\` - \`exports["${exp._path}"].import\` must end with "${ext.esm}"`,
      )
    }
  }

  return errors
}
