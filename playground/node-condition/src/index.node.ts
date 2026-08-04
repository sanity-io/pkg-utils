import {readFileSync} from 'node:fs'

/** @public */
export const version = process.env.PKG_VERSION as string

/** @public */
export function readPackageJson(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}
