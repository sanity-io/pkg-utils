import fs from 'node:fs/promises'
import type {PackageJSON} from './types'

/** @internal */
export async function loadPkg(options: {cwd: string}): Promise<PackageJSON> {
  const [{default: pkgUp}, {validatePkg}] = await Promise.all([
    import('pkg-up'),
    import('./validatePkg'),
  ])
  const {cwd} = options

  const pkgPath = await pkgUp({cwd})

  if (!pkgPath) throw new Error('no package.json found')

  const buf = await fs.readFile(pkgPath)

  const raw = JSON.parse(buf.toString())

  validatePkg(raw)

  return raw
}
