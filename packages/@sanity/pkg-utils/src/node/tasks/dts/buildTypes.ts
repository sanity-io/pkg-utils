import type ts from '@typescript/typescript6'
import {getCompilerApi} from '../../core/ts/compilerApi.ts'
import type {Logger} from '../../logger.ts'
import {printDiagnostic} from './printDiagnostic.ts'

/** @internal */
export async function buildTypes(options: {
  cwd: string
  logger: Logger
  outDir: string
  tsconfig: ts.ParsedCommandLine
  strict: boolean
  checkTypes?: boolean
}): Promise<void> {
  const {cwd, logger, outDir, tsconfig, strict, checkTypes} = options
  const tsApi = await getCompilerApi()

  const compilerOptions: ts.CompilerOptions = {
    ...tsconfig.options,
    declaration: true,
    declarationDir: outDir,
    emitDeclarationOnly: true,
    noEmit: false,
    noEmitOnError: strict ? true : (tsconfig.options.noEmitOnError ?? true),
    noCheck:
      checkTypes === false
        ? true
        : (tsconfig.options.noCheck ?? tsconfig.options.isolatedDeclarations),
    outDir,
  }

  const program = tsApi.createProgram(tsconfig.fileNames, compilerOptions)

  const emitResult = program.emit()

  const allDiagnostics = tsApi.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

  for (const diagnostic of allDiagnostics) {
    printDiagnostic({cwd, logger, diagnostic, tsApi})
  }

  if (emitResult.emitSkipped) {
    const errors = allDiagnostics.filter((diag) => diag.category === tsApi.DiagnosticCategory.Error)

    if (errors.length) {
      throw new Error('failed to compile TypeScript definitions')
    }
  }
}
