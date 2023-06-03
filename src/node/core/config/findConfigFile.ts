import findConfig from 'find-config'
import {stat} from 'fs/promises'
import path from 'path'

const CONFIG_FILE_NAMES = [
  'package.config.ts',
  'package.config.js',
  'package.config.cjs',
  'package.config.mjs',
]

export async function findConfigFile(cwd: string): Promise<string | undefined> {
  const pkgJsonPath = findConfig('package.json', {cwd})

  if (!pkgJsonPath) return undefined

  const pkgPath = path.dirname(pkgJsonPath)

  for (const fileName of CONFIG_FILE_NAMES) {
    const configPath = path.resolve(pkgPath, fileName)

    const exists = await fileExists(configPath)

    if (exists) {
      return configPath
    }
  }

  return undefined
}

async function fileExists(filePath: string) {
  try {
    await stat(filePath)

    return true
  } catch (_) {
    return false
  }
}
