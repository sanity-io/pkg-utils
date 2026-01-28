import type {ExtractorResult} from '@microsoft/api-extractor'
import ts from 'typescript'

/**
 * A workaround to find all module blocks in extract TS files.
 * @internal
 * */
export function extractModuleBlocksFromTypes({
  tsOutDir,
  extractResult,
}: {
  tsOutDir: string
  extractResult: ExtractorResult
}): string[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ExtractorResult type from @microsoft/api-extractor is complex
  const program = extractResult.compilerState.program as ts.Program
  const moduleBlocks: string[] = []

  // all program files, including node_modules
  const allProgramFiles = [...program.getSourceFiles()]

  // just our compiled files used in the program
  const sourceFiles = allProgramFiles.filter((sourceFile) => sourceFile.fileName.includes(tsOutDir))

  for (const sourceFile of sourceFiles) {
    if (sourceFile.text.includes('declare module')) {
      // Re-parse the source file to ensure we have a complete AST
      // The source files from API Extractor's program may not have fully parsed statements
      const parsedFile = ts.createSourceFile(
        sourceFile.fileName,
        sourceFile.text,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ true,
      )
      moduleBlocks.push(...extractModuleBlocks(parsedFile))
    }
  }

  return moduleBlocks
}

/**
 * Extract `declare module` blocks from a TypeScript source file.
 */
function extractModuleBlocks(sourceFile: ts.SourceFile): string[] {
  const text = sourceFile.text
  const moduleBlocks: string[] = []

  const statements = sourceFile.statements
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    if (statement && ts.isModuleDeclaration(statement)) {
      // Get positions for extracting text
      const fullStart = statement.getFullStart()
      const start = statement.getStart(sourceFile)
      let end = statement.getEnd()

      // Include trailing comments (like sourceMappingURL)
      // First check for same-line trailing comments
      const trailingComments = ts.getTrailingCommentRanges(text, end)
      const lastTrailing = trailingComments?.at(-1)
      if (lastTrailing) {
        end = lastTrailing.end
      } else {
        // Check for comments on following lines (only if this is the last statement
        // or if they come before the next statement)
        const nextStatement = statements[i + 1]
        const nextStatementStart = nextStatement?.getFullStart() ?? text.length
        const commentsAfter = ts.getLeadingCommentRanges(text, end)
        const lastCommentAfter = commentsAfter?.at(-1)
        if (lastCommentAfter && lastCommentAfter.end <= nextStatementStart) {
          end = lastCommentAfter.end
        }
      }

      // Check for leading JSDoc comments
      const leadingComments = ts.getLeadingCommentRanges(text, fullStart)

      let blockStart = start
      if (leadingComments && leadingComments.length > 0) {
        // Use the last comment if it's a JSDoc comment (starts with /**)
        const lastComment = leadingComments.at(-1)
        if (lastComment) {
          const commentText = text.slice(lastComment.pos, lastComment.end)
          if (commentText.startsWith('/**')) {
            blockStart = lastComment.pos
          }
        }
      }

      // Extract the text from blockStart to end
      // No need to dedent - the output will be formatted by prettier
      moduleBlocks.push(text.slice(blockStart, end))
    }
  }

  return moduleBlocks
}
