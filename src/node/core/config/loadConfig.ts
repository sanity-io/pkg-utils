import {createRequire} from 'node:module'
import path from 'node:path'
import {packageUp} from 'package-up'
import {register} from 'tsx/cjs/api'
import {findConfigFile} from './findConfigFile.ts'
import type {PkgConfigOptions} from './types.ts'

const require = createRequire(import.meta.url)

declare global {
  var ___DEV___: boolean
}

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

  const unregister = globalThis.___DEV___ ? () => undefined : register()

  const mod = require(configFile)

  unregister()

  return mod?.default || mod || undefined
}
