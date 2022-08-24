/* eslint-disable no-console */

import path from 'path'
import ts from 'typescript'
import {_loadTSConfig} from './_loadTSConfig'

export const formatHost: ts.FormatDiagnosticsHost = {
  getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
  getNewLine: () => ts.sys.newLine,
  getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? (f) => f : (f) => f.toLowerCase(),
}

/**
 * @internal
 */
export async function _buildTypes(options: {
  cwd: string
  outDir: string
  sourcePath: string
  tsconfigPath: string
}): Promise<{path: string}> {
  const {cwd, outDir, sourcePath, tsconfigPath} = options

  const config = await _loadTSConfig({cwd, tsconfigPath})

  const compilerOptions: ts.CompilerOptions = {
    ...config.options,
    emitDeclarationOnly: true,
    outDir,
  }

  const program = ts.createProgram([path.resolve(cwd, sourcePath)], compilerOptions)

  const emitResult = program.emit()

  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

  allDiagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      const {line, character} = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start!)
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
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

  return {
    path: path.resolve(outDir, sourcePath.replace(/\.ts$/, '.d.ts')),
  }
}
