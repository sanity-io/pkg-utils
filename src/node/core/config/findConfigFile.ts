import path from 'node:path'

import findConfig from 'find-config'

import {fileExists} from '../../fileExists'

const CONFIG_FILE_NAMES = [
  'package.config.ts',
  'package.config.js',
  'package.config.cjs',
  'package.config.mjs',
]

/** @internal */
export function findConfigFile(cwd: string): string | undefined {
  const pkgJsonPath = findConfig('package.json', {cwd})

  if (!pkgJsonPath) return undefined

  const pkgPath = path.dirname(pkgJsonPath)

  for (const fileName of CONFIG_FILE_NAMES) {
    const configPath = path.resolve(pkgPath, fileName)

    const exists = fileExists(configPath)

    if (exists) {
      return configPath
    }
  }

  return undefined
}
