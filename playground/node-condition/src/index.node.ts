import {readFileSync} from 'node:fs'

/** @public */
export const runtime = process.env.PKG_RUNTIME as string

/** @public */
export function readPackageJson(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}
