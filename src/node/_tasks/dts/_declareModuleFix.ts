import fs from 'fs/promises'
import {ExtractorResult} from '@microsoft/api-extractor'
import {Program} from 'typescript'

/**
 * '@microsoft/api-extractor' omits declare module blocks
 * This is a workaround that finds all module blocks in ts files and appends them to the result
 */
export async function _appendModuleBlocks({
  tsOutDir,
  extractResult,
  extractTypesOutFile,
}: {
  tsOutDir: string
  extractResult: ExtractorResult
  extractTypesOutFile: string
}): Promise<void> {
  const moduleBlocks = await _extractModuleBlocksFromTypes({tsOutDir, extractResult})

  if (moduleBlocks.length) {
    await fs.appendFile(extractTypesOutFile, '\n' + moduleBlocks.join('\n\n'))
  }
}

async function _extractModuleBlocksFromTypes({
  tsOutDir,
  extractResult,
}: {
  tsOutDir: string
  extractResult: ExtractorResult
}): Promise<string[]> {
  const moduleBlocks: string[] = []

  const program = extractResult.compilerState.program as Program

  // all program files, including node_modules
  const allProgramFiles = [...program.getSourceFiles()]

  // just our compiled files used in the program
  const sourceFiles = allProgramFiles.filter((sourceFile) => sourceFile.fileName.includes(tsOutDir))

  for (const sourceFile of sourceFiles) {
    if (sourceFile.text.includes('declare module')) {
      moduleBlocks.push(..._extractModuleBlocks(sourceFile.text))
    }
  }

  return moduleBlocks
}

export function _extractModuleBlocks(fileContent: string): string[] {
  const moduleBlocks: string[] = []

  let moduleIndentLevel = 0
  let insideComment = false
  let moduleLines: string[] = []

  const lines = fileContent.split('\n')

  for (const line of lines) {
    // Note: Extractor already removes comment blocks, so fileContent is typically already comment free
    // This is just defensive code, just in case
    if (insideComment && line.indexOf('*/') > 0) {
      insideComment = false
    } else if (!insideComment && line.indexOf('/*') > 0) {
      insideComment = true
    }

    if (insideComment) {
      continue
    }

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
