import fs from 'fs/promises'
import pkgUp from 'pkg-up'
import {_PackageJSON} from './_types'
import {_validatePkg} from './_validatePkg'

/** @internal */
export async function _loadPkg(options: {cwd: string}): Promise<_PackageJSON> {
  const {cwd} = options

  const pkgPath = await pkgUp({cwd})

  if (!pkgPath) throw new Error('no package.json found')

  const buf = await fs.readFile(pkgPath)

  return _validatePkg(JSON.parse(buf.toString()))
}
