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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ExtractorResult type from @microsoft/api-extractor is complex
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


function extractModuleBlocks(fileContent: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Babel parser returns any, but we know it's a File
  const ast = parse(fileContent, {
    parser: typeScriptParser,
  }) as File

  return ast.program.body
    .filter((node) => node.type === 'TSModuleDeclaration')
    .map((node) => print(node).code)
}
