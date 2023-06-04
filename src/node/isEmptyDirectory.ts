import {readdir} from 'fs/promises'

export async function isEmptyDirectory(dirPath: string): Promise<boolean> {
  return (await readdir(dirPath)).length === 0
}
