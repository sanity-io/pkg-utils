import fs from 'fs/promises'
import pkgUp from 'pkg-up'
import {PackageJSON} from './types'
import {validatePkg} from './validatePkg'

/** @internal */
export async function loadPkg(options: {cwd: string}): Promise<PackageJSON> {
  const {cwd} = options

  const pkgPath = await pkgUp({cwd})

  if (!pkgPath) throw new Error('no package.json found')

  const buf = await fs.readFile(pkgPath)

  return validatePkg(JSON.parse(buf.toString()))
}
