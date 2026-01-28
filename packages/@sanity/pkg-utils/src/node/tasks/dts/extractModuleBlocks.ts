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
      moduleBlocks.push(...extractModuleBlocks(sourceFile))
    }
  }

  return moduleBlocks
}

/**
 * Extract `declare module` blocks from a TypeScript source file.
 */
function extractModuleBlocks(sourceFile: ts.SourceFile): string[] {
  const moduleBlocks: string[] = []

  for (const statement of sourceFile.statements) {
    if (ts.isModuleDeclaration(statement)) {
      // Get positions for extracting text
      const fullStart = statement.getFullStart()
      const start = statement.getStart(sourceFile)
      const end = statement.getEnd()

      // Check for leading JSDoc comments
      const leadingComments = ts.getLeadingCommentRanges(sourceFile.text, fullStart)

      let blockStart = start
      if (leadingComments && leadingComments.length > 0) {
        // Use the last comment if it's a JSDoc comment (starts with /**)
        const lastComment = leadingComments.at(-1)
        if (lastComment) {
          const commentText = sourceFile.text.slice(lastComment.pos, lastComment.end)
          if (commentText.startsWith('/**')) {
            blockStart = lastComment.pos
          }
        }
      }

      // Find the start of the line containing blockStart
      // This ensures we capture the leading whitespace for proper dedenting
      let lineStart = blockStart
      while (lineStart > 0 && sourceFile.text[lineStart - 1] !== '\n') {
        lineStart--
      }

      // Extract the text from the start of the line
      const blockText = sourceFile.text.slice(lineStart, end)

      // Dedent the block to remove common leading whitespace
      moduleBlocks.push(dedent(blockText))
    }
  }

  return moduleBlocks
}

/**
 * Remove common leading whitespace from all lines.
 */
function dedent(text: string): string {
  const lines = text.split('\n')

  // Find minimum indentation (ignoring empty lines)
  let minIndent = Infinity
  for (const line of lines) {
    if (line.trim().length === 0) continue
    const match = line.match(/^(\s*)/)
    if (match?.[1] !== undefined) {
      minIndent = Math.min(minIndent, match[1].length)
    }
  }

  if (minIndent === Infinity || minIndent === 0) {
    return text.trim()
  }

  // Remove the common indentation from each line
  const dedentedLines = lines.map((line) => (line.length >= minIndent ? line.slice(minIndent) : line))

  return dedentedLines.join('\n').trim()
}
