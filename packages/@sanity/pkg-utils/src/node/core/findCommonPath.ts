import path from 'node:path'

export function pathContains(containerPath: string, itemPath: string): boolean {
  return !path.relative(containerPath, itemPath).startsWith('..')
}

export function findCommonDirPath(filePaths: string[]): string | undefined {
  let ret: string | undefined = undefined

  for (const filePath of filePaths) {
    let dirPath = path.dirname(filePath)

    if (!ret) {
      ret = dirPath
      continue
    }

    while (dirPath !== ret) {
      dirPath = path.dirname(dirPath)

      if (dirPath === ret) {
        break
      }

      if (pathContains(dirPath, ret)) {
        ret = dirPath
        break
      }

      if (dirPath === '.') return undefined
    }
  }

  return ret
}
