/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK), with the
 * `find-up` dependency replaced by an inline walk-up loop
 * (https://e18e.dev/docs/replacements/find-up.html).
 */
import fs from 'node:fs'
import path from 'node:path'

/**
 * The nearest `package.json` with a `name`, resolved by {@link getPackageInfo}.
 * @public
 */
export interface PackageInfo {
  name: string
  path: string
  dirname: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getClosestPackageInfo(directory: string): Partial<PackageInfo> | undefined {
  let currentDirectory = path.resolve(directory)

  while (true) {
    const packageJsonPath = path.join(currentDirectory, 'package.json')

    if (fs.existsSync(packageJsonPath)) {
      const manifest: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      const name = isRecord(manifest) ? manifest['name'] : undefined
      return {
        ...(typeof name === 'string' && name ? {name} : {}),
        path: packageJsonPath,
        dirname: currentDirectory,
      }
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) return undefined
    currentDirectory = parentDirectory
  }
}

const packageInfoCache = new Map<string, PackageInfo>()

/**
 * Resolves the nearest `package.json` with a `name` field, walking up from `cwd` (and past
 * nameless `package.json` files). Results are cached per starting directory (normalized, so
 * relative and absolute spellings of the same directory share an entry).
 * @public
 */
export function getPackageInfo(cwd?: string | null): PackageInfo {
  const resolvedCwd = path.resolve(cwd ?? process.cwd())
  const cachedValue = packageInfoCache.get(resolvedCwd)

  if (cachedValue) {
    return cachedValue
  }

  let packageInfo = getClosestPackageInfo(resolvedCwd)

  while (packageInfo && !packageInfo.name) {
    packageInfo = getClosestPackageInfo(path.resolve(packageInfo.dirname ?? resolvedCwd, '..'))
  }

  if (!packageInfo || !packageInfo.name) {
    throw new Error(`Couldn't find parent package.json with a name field from '${resolvedCwd}'`)
  }

  const resolvedPackageInfo: PackageInfo = {
    name: packageInfo.name,
    path: packageInfo.path ?? '',
    dirname: packageInfo.dirname ?? '',
  }

  packageInfoCache.set(resolvedCwd, resolvedPackageInfo)

  return resolvedPackageInfo
}
