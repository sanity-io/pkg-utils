import fs from 'fs/promises'
import type {File} from '@babel/types'
import {ExtractorResult} from '@microsoft/api-extractor'
import {parse, print} from 'recast'
import typeScriptParser from 'recast/parsers/typescript'
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
  const ast = parse(fileContent, {
    parser: typeScriptParser,
  }) as File

  return ast.program.body
    .filter((node) => node.type === 'TSModuleDeclaration')
    .map((node) => print(node).code)
}
