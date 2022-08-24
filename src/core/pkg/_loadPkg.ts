import pkgUp from 'pkg-up'
import {_PackageJSON} from './_types'

/**
 * @internal
 */
export async function _loadPkg(options: {cwd: string}): Promise<_PackageJSON> {
  const {cwd} = options

  const pkgPath = await pkgUp({cwd})

  return pkgPath ? require(pkgPath) : undefined
}
