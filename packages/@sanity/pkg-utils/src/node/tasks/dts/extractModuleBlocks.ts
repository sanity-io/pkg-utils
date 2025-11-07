import type {File} from '@babel/types'
import type {ExtractorResult} from '@microsoft/api-extractor'
import {parse, print} from 'recast'
import typeScriptParser from 'recast/parsers/typescript.js'
import type {Program} from 'typescript'

/**
 * A workaround to find all module blocks in extract TS files.
 * @internal
 * */
export async function extractModuleBlocksFromTypes({
  tsOutDir,
  extractResult,
}: {
  tsOutDir: string
  extractResult: ExtractorResult
}): Promise<string[]> {
  const program = extractResult.compilerState.program as Program
  const moduleBlocks: string[] = []

  // all program files, including node_modules
  const allProgramFiles = [...program.getSourceFiles()]

  // just our compiled files used in the program
  const sourceFiles = allProgramFiles.filter((sourceFile) => sourceFile.fileName.includes(tsOutDir))

  for (const sourceFile of sourceFiles) {
    if (sourceFile.text.includes('declare module')) {
      moduleBlocks.push(...extractModuleBlocks(sourceFile.text))
    }
  }

  return moduleBlocks
}

/** @internal */
export function extractModuleBlocks(fileContent: string): string[] {
  const ast = parse(fileContent, {
    parser: typeScriptParser,
  }) as File

  return ast.program.body
    .filter((node) => node.type === 'TSModuleDeclaration')
    .map((node) => print(node).code)
}
