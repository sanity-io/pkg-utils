import fs from 'node:fs/promises'
import type {PackageJSON} from '@sanity/parse-package-json'
import {validatePkg} from './validatePkg.ts'

/** @internal */
export async function loadPkg(options: {pkgPath: string}): Promise<PackageJSON> {
  const {pkgPath} = options

  const raw = JSON.parse(await fs.readFile(pkgPath, 'utf-8'))

  validatePkg(raw)

  return raw
}
