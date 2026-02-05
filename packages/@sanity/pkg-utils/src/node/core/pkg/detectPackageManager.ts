import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {detect} from 'package-manager-detector/detect'

/**
 * Result of package manager detection
 */
export interface PackageManagerInfo {
  name: string
  version?: string
}

/**
 * Detects the package manager from the packageManager field in package.json
 * Walks up the directory tree to find a package.json with the packageManager field
 */
async function detectPackageManagerFromField(cwd: string): Promise<PackageManagerInfo | null> {
  let currentDir = cwd
  const root = resolve('/')

  while (currentDir !== root) {
    try {
      const pkgPath = resolve(currentDir, 'package.json')
      const pkgContent = await readFile(pkgPath, 'utf-8')
      const pkg = JSON.parse(pkgContent)

      if (pkg.packageManager && typeof pkg.packageManager === 'string') {
        // Parse packageManager field (format: "pnpm@9.0.0" or "npm@10.0.0")
        const match = pkg.packageManager.match(/^([^@]+)@?(.*)$/)
        if (match && match[1]) {
          return {
            name: match[1],
            version: match[2] || undefined,
          }
        }
      }
    } catch {
      // Package.json doesn't exist or can't be read, continue to parent
    }

    const parentDir = resolve(currentDir, '..')
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  return null
}

/**
 * Detects the package manager used in the project
 * Uses package-manager-detector to check for lock files and packageManager field
 */
export async function detectPackageManager(cwd: string): Promise<PackageManagerInfo | null> {
  try {
    // First try using package-manager-detector which checks lock files and packageManager field
    const result = await detect({
      cwd,
      strategies: ['packageManager-field', 'lockfile'],
    })

    if (result) {
      return {
        name: result.agent,
        version: result.version,
      }
    }

    // If package-manager-detector doesn't find anything,
    // walk up the tree looking for packageManager field
    const fromField = await detectPackageManagerFromField(cwd)
    if (fromField) {
      return fromField
    }

    return null
  } catch {
    return null
  }
}

/**
 * Checks if the package manager is pnpm
 */
export async function isPnpm(cwd: string): Promise<boolean> {
  const pm = await detectPackageManager(cwd)
  return pm?.name === 'pnpm'
}

/**
 * Validates that pnpm is being used as the package manager
 * Returns an error message if pnpm is not being used, null otherwise
 */
export async function validatePnpmPackageManager(cwd: string): Promise<string | null> {
  const pm = await detectPackageManager(cwd)

  if (!pm) {
    return 'Cannot determine package manager. The `monorepo` export condition requires `packageManager` field to be set to `pnpm` in package.json.'
  }

  if (pm.name !== 'pnpm') {
    return `The \`monorepo\` export condition requires pnpm but found ${pm.name}. Set \`"packageManager": "pnpm@<version>"\` in package.json.`
  }

  return null
}
