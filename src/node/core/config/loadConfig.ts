import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {packageUp} from 'package-up'
import {tsImport} from 'tsx/esm/api'
import {findConfigFile} from './findConfigFile.ts'
import type {PkgConfigOptions} from './types.ts'

/** @alpha */
export async function loadConfig(options: {cwd: string}): Promise<PkgConfigOptions | undefined> {
  const {cwd} = options

  const pkgPath = await packageUp({cwd})

  if (!pkgPath) return undefined

  const root = path.dirname(pkgPath)

  const configFile = await findConfigFile(root)

  if (!configFile) {
    return undefined
  }

  // Do not accept config files outside of the root
  if (!configFile.startsWith(cwd)) {
    return undefined
  }

  // Windows does not support import() absolute paths, they must be converted to URLs
  const configFileUrl = pathToFileURL(configFile).toString()
  const mod = await tsImport(configFileUrl, import.meta.url)
  return mod?.default || mod || undefined
}
