import fs from 'node:fs/promises'

import pkgUp from 'pkg-up'

import type {PackageJSON} from './types'
import {validatePkg} from './validatePkg'

/** @internal */
export async function loadPkg(options: {cwd: string}): Promise<PackageJSON> {
  const {cwd} = options

  const pkgPath = await pkgUp({cwd})

  if (!pkgPath) throw new Error('no package.json found')

  const buf = await fs.readFile(pkgPath)

  const raw = JSON.parse(buf.toString())

  validatePkg(raw)

  return raw
}
