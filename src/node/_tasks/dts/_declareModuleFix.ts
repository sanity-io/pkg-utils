import fs from 'fs/promises'
import path from 'path'

/**
 * '@microsoft/api-extractor' omits declare module blocks
 * This is a workaround that finds all module blocks in ts files and appends them to the result
 */
export async function _appendModuleBlocks({
  tsOutDir,
  extractTypesOutFile,
}: {
  tsOutDir: string
  extractTypesOutFile: string
}): Promise<void> {
  const moduleBlocks = await _extractModuleBlocksFromTypes(tsOutDir)

  if (moduleBlocks.length) {
    await fs.appendFile(extractTypesOutFile, '\n' + moduleBlocks.join('\n\n'))
  }
}

async function _extractModuleBlocksFromTypes(dirname: string): Promise<string[]> {
  const moduleBlocks: string[] = []

  const files = await _getFileList(dirname)

  for (const fileName of files) {
    const content = await fs.readFile(path.resolve(dirname, fileName), {
      encoding: 'utf-8',
    })

    if (content.includes('declare module')) {
      moduleBlocks.push(..._extractModuleBlocks(content))
    }
  }

  return moduleBlocks
}

async function _getFileList(dirName: string): Promise<string[]> {
  let files: string[] = []
  const filesInCurrentDir = await fs.readdir(dirName, {withFileTypes: true})

  for (const fileInDir of filesInCurrentDir) {
    if (fileInDir.isDirectory()) {
      files = [...files, ...(await _getFileList(path.resolve(dirName, fileInDir.name)))]
    } else {
      files.push(path.resolve(dirName, fileInDir.name))
    }
  }

  return files
}

export function _extractModuleBlocks(fileContent: string): string[] {
  const moduleBlocks: string[] = []

  let moduleIndentLevel = 0
  let moduleLines: string[] = []

  const lines = fileContent.split('\n')

  for (const line of lines) {
    if (!moduleLines.length) {
      const moduleIndex = line.indexOf('declare module')
      const isModuleStart = moduleIndex > -1

      if (isModuleStart) {
        moduleIndentLevel = moduleIndex
        moduleLines = [line]
      }
    } else {
      moduleLines.push(line)
      const blockEndIndex = line.indexOf('}')

      if (blockEndIndex === moduleIndentLevel) {
        moduleBlocks.push(
          moduleLines.map((l) => l.substring(moduleIndentLevel, l.length)).join('\n')
        )
        moduleLines = []
      }
    }
  }

  return moduleBlocks
}
