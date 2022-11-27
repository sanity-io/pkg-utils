import path from 'path'
import {register} from 'esbuild-register/dist/node'
import pkgUp from 'pkg-up'
import {findConfigFile} from './findConfigFile'
import {PkgConfigOptions} from './types'

/** @internal */
export async function loadConfig(options: {cwd: string}): Promise<PkgConfigOptions | undefined> {
  const {cwd} = options

  const pkgPath = await pkgUp({cwd})

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

  try {
    const {unregister} = register({extensions: ['.js', '.mjs', '.ts']})

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(configFile)

    unregister()

    return mod?.default || mod || undefined
  } catch (_) {
    return undefined
  }
}
