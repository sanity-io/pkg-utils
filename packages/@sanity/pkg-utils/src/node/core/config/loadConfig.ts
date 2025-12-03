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
  if (!configFile.startsWith(cwd)) {
    return undefined
  }

  const mod = await tsImport(pathToFileURL(configFile).toString(), import.meta.url)

  return mod?.default || mod || undefined
}
