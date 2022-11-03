import fs from 'fs/promises'
import path from 'path'
import globby from 'globby'

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

  const files = await globby(path.resolve(dirname, '**/*.d.ts'))

  for (const fileName of files) {
    if (fileName.includes('.test.')) {
      continue
    }
    const content = await fs.readFile(path.resolve(dirname, fileName), {
      encoding: 'utf-8',
    })

    if (content.includes('declare module')) {
      moduleBlocks.push(..._extractModuleBlocks(content))
    }
  }

  return moduleBlocks
}

export function _extractModuleBlocks(fileContent: string): string[] {
  const moduleBlocks: string[] = []

  let moduleIndentLevel = 0
  let moduleLines: string[] = []

  const lines = fileContent.split('\n')

  for (const line of lines) {
    if (!moduleLines.length) {
      const isModuleDeclaration = line.match(/^\s*declare module.+$/)?.length
      const moduleIndex = line.indexOf('declare module')
      const isModuleStart = isModuleDeclaration && moduleIndex > -1

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
