import path from 'path'
import {register} from 'esbuild-register/dist/node'
import findConfig from 'find-config'
import pkgUp from 'pkg-up'
import {PkgConfigOptions} from './types'

/** @internal */
export async function _loadConfig(options: {cwd: string}): Promise<PkgConfigOptions | undefined> {
  const {cwd} = options

  const pkgPath = await pkgUp({cwd})

  if (!pkgPath) return undefined

  const root = path.dirname(pkgPath)

  const configFile = _findConfigFile(root)

  if (!configFile) {
    return undefined
  }

  try {
    const {unregister} = configFile.transform
      ? register({extensions: ['.js', '.ts']})
      : {unregister: () => undefined}

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(configFile.path)

    unregister()

    return mod?.default || mod || undefined
  } catch (_) {
    return undefined
  }
}

// Looks for:
// 1. package.config.ts
// 2. package.config.cjs
//
function _findConfigFile(cwd: string): {path: string; transform: boolean} | null {
  const ts = findConfig('package.config.ts', {cwd})

  if (ts) return {path: ts, transform: true}

  const cjs = findConfig('package.config.cjs', {cwd})

  if (cjs) return {path: cjs, transform: false}

  return null
}
