import {realpathSync} from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {tsImport} from 'tsx/esm/api'
import {findConfigFile} from './findConfigFile.ts'
import type {PkgConfigOptions} from './types.ts'

/** @alpha */
export async function loadConfig(options: {
  cwd: string
  pkgPath: string
}): Promise<PkgConfigOptions | undefined> {
  const {cwd, pkgPath} = options

  const root = path.dirname(pkgPath)

  const configFile = findConfigFile(root)

  if (!configFile) {
    return undefined
  }

  // Do not accept config files outside of the root
  // Resolve symlinks to ensure accurate path comparison
  try {
    const realConfigFile = realpathSync(configFile)
    const realCwd = realpathSync(cwd)
    
    // Use path.relative to check if config is within cwd
    // If the relative path starts with '..', the config is outside the root
    const relativePath = path.relative(realCwd, realConfigFile)
    
    if (relativePath.startsWith('..')) {
      return undefined
    }
  } catch {
    // If we can't resolve paths, fall back to original check
    const relativePath = path.relative(cwd, configFile)
    
    if (relativePath.startsWith('..')) {
      return undefined
    }
  }

  const mod = await tsImport(pathToFileURL(configFile).toString(), import.meta.url)

  return mod?.default || mod || undefined
}
