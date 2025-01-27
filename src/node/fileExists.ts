import {statSync} from 'node:fs'

/** @internal */
export function fileExists(filePath: string): boolean {
  try {
    statSync(filePath)

    return true
  } catch {
    return false
  }
}
