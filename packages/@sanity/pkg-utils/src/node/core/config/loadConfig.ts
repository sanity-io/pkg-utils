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

  // Resolve symlinks in the config file path to get the real path
  // This is important when config files are accessed through symlinked node_modules
  let resolvedConfigFile = configFile
  try {
    resolvedConfigFile = realpathSync(configFile)
  } catch {
    // If we can't resolve the symlink, use the original path
    resolvedConfigFile = configFile
  }

  // Do not accept config files outside of the root
  // Resolve symlinks to ensure accurate path comparison
  try {
    const realCwd = realpathSync(cwd)
    
    // Use path.relative to check if config is within cwd
    // If the relative path starts with '..', the config is outside the root
    const relativePath = path.relative(realCwd, resolvedConfigFile)
    
    if (relativePath.startsWith('..')) {
      return undefined
    }
  } catch {
    // If we can't resolve paths, fall back to original check
    const relativePath = path.relative(cwd, resolvedConfigFile)
    
    if (relativePath.startsWith('..')) {
      return undefined
    }
  }

  // Use the resolved config file path for importing
  const mod = await tsImport(pathToFileURL(resolvedConfigFile).toString(), import.meta.url)

  return mod?.default || mod || undefined
}
