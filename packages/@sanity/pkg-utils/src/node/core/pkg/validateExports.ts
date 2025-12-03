import type {PackageJSON} from '@sanity/parse-package-json'
import type {PkgExport} from '../config/types.ts'
import {pkgExtMap as extMap} from './pkgExt.ts'

export function validateExports(
  _exports: (PkgExport & {_path: string})[],
  options: {pkg: PackageJSON},
): string[] {
  const {pkg} = options
  const type = pkg.type || 'commonjs'
  const ext = extMap[type]

  const errors: string[] = []

  for (const exp of _exports) {
    if (exp.require && !exp.require.endsWith(ext.commonjs)) {
      errors.push(
        `package.json with \`type: "${type}"\` - \`exports["${exp._path}"].require\` must end with "${ext.commonjs}"`,
      )
    }

    if (exp.import && !exp.import.endsWith(ext.esm)) {
      errors.push(
        `package.json with \`type: "${type}"\` - \`exports["${exp._path}"].import\` must end with "${ext.esm}"`,
      )
    }
  }

  return errors
}
