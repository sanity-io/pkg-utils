import ts from 'typescript'

import type {Logger} from '../../logger'
import {printDiagnostic} from './printDiagnostic'

/** @internal */
export async function buildTypes(options: {
  cwd: string
  logger: Logger
  outDir: string
  tsconfig: ts.ParsedCommandLine
  strict: boolean
}): Promise<void> {
  const {cwd, logger, outDir, tsconfig, strict = false} = options

  const compilerOptions: ts.CompilerOptions = {
    ...tsconfig.options,
    declaration: true,
    declarationDir: outDir,
    emitDeclarationOnly: true,
    noEmit: false,
    noEmitOnError: strict ? true : (tsconfig.options.noEmitOnError ?? true),
    outDir,
  }

  const program = ts.createProgram(tsconfig.fileNames, compilerOptions)

  const emitResult = program.emit()

  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

  for (const diagnostic of allDiagnostics) {
    printDiagnostic({cwd, logger, diagnostic})
  }

  if (emitResult.emitSkipped) {
    const errors = allDiagnostics.filter((diag) => diag.category === ts.DiagnosticCategory.Error)

    if (errors.length) {
      throw new Error('failed to compile TypeScript definitions')
    }
  }
}
