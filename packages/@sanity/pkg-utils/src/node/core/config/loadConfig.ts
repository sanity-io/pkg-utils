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
    
    // Normalize cwd with trailing separator to prevent false matches
    // e.g., prevent /path/to/config matching /path/to/configDir/file
    const normalizedCwd = realCwd.endsWith(path.sep) ? realCwd : realCwd + path.sep
    
    if (!realConfigFile.startsWith(normalizedCwd) && realConfigFile !== realCwd) {
      return undefined
    }
  } catch {
    // If we can't resolve paths, fall back to original check
    const normalizedCwd = cwd.endsWith(path.sep) ? cwd : cwd + path.sep
    
    if (!configFile.startsWith(normalizedCwd) && configFile !== cwd) {
      return undefined
    }
  }

  const mod = await tsImport(pathToFileURL(configFile).toString(), import.meta.url)

  return mod?.default || mod || undefined
}
