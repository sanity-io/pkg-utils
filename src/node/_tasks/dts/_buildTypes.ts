/* eslint-disable no-console */

import path from 'path'
import ts from 'typescript'

export const formatHost: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getNewLine: () => ts.sys.newLine,
  getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? (f) => f : (f) => f.toLowerCase(),
}

/** @internal */
export async function _buildTypes(options: {
  cwd: string
  outDir: string
  sourcePath: string
  tsconfig: ts.ParsedCommandLine
}): Promise<{path: string}> {
  const {cwd, outDir, sourcePath, tsconfig} = options

  const compilerOptions: ts.CompilerOptions = {
    ...tsconfig.options,
    declaration: true,
    declarationDir: outDir,
    emitDeclarationOnly: true,
    noEmit: false,
    outDir,
  }

  const program = ts.createProgram(tsconfig.fileNames, compilerOptions)

  const sourceFiles = program.getSourceFiles()
  const sourceFile = sourceFiles.find((f) => f.fileName === path.resolve(cwd, sourcePath))

  if (!sourceFile) {
    throw new Error(`source file not found: ${sourcePath}`)
  }

  const emitResult = program.emit()

  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

  allDiagnostics.forEach((diagnostic) => {
    if (diagnostic.file && diagnostic.start) {
      const {line, character} = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start)
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

      console.log(`${diagnostic.file.fileName} ${line + 1}:${character + 1}\n${message}`)
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    }
  })

  if (emitResult.emitSkipped) {
    const errors = allDiagnostics.filter((diag) => diag.category === ts.DiagnosticCategory.Error)

    if (errors.length) {
      console.error(ts.formatDiagnostics(errors, formatHost))

      throw new Error('failed to compile')
    }
  }

  const typesPath = path.resolve(outDir, sourcePath.replace(/\.ts$/, '.d.ts'))

  return {path: typesPath}
}
