import {statSync} from 'fs'

/** @internal */
export function fileExists(filePath: string): boolean {
  try {
    statSync(filePath)

    return true
  } catch (_) {
    return false
  }
}
