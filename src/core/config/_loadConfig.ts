import path from 'path'
import {register} from 'esbuild-register/dist/node'
import pkgUp from 'pkg-up'
import {PkgConfigOptions} from './types'

/**
 * @internal
 */
export async function _loadConfig(options: {cwd: string}): Promise<PkgConfigOptions | undefined> {
  const {cwd} = options

  const pkgPath = await pkgUp({cwd})

  if (!pkgPath) return undefined

  const root = path.dirname(pkgPath)

  try {
    const {unregister} = register({extensions: ['.js', '.ts']})

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(path.resolve(root, 'package.config.ts'))

    unregister()

    return mod.default
  } catch (_) {
    return undefined
  }
}
