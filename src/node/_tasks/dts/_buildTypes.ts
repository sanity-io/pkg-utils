/* eslint-disable no-console */

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
  tsconfig: ts.ParsedCommandLine
}): Promise<void> {
  const {outDir, tsconfig} = options

  const compilerOptions: ts.CompilerOptions = {
    ...tsconfig.options,
    declaration: true,
    declarationDir: outDir,
    emitDeclarationOnly: true,
    noEmit: false,
    outDir,
  }

  const program = ts.createProgram(tsconfig.fileNames, compilerOptions)

  const emitResult = program.emit()

  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

  // TODO: improve logging
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
}
