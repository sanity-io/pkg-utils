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
  const {cwd, logger, outDir, tsconfig} = options

  const compilerOptions: ts.CompilerOptions = {
    ...tsconfig.options,
    declaration: true,
    declarationDir: outDir,
    emitDeclarationOnly: true,
    noEmit: false,
    outDir,
    // Support the new `module: 'preserve'` option in TypeScript 5.4
    ...(tsconfig.options.module === ts.ModuleKind.Preserve
      ? {
          // Set the equivalent options to `module: 'Preserve'`
          // https://github.com/microsoft/TypeScript/pull/56785/files?file-filters%5B%5D=.js&file-filters%5B%5D=.json&file-filters%5B%5D=.symbols&file-filters%5B%5D=.ts&file-filters%5B%5D=.types&show-viewed-files=true#diff-31d3c12bafea26bc9e8c8a77920c41af0c593206442add70c45a06c063767445
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          esModuleInterop: true,
          resolveJsonModule: true,
        }
      : {}),
  }

  const program = ts.createProgram(tsconfig.fileNames, compilerOptions)

  const emitResult = program.emit()

  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

  for (const diagnostic of allDiagnostics) {
    // @TODO match the import with known export paths
    // Ignore TS2307 errors as they'll be captured elsewhere if they're actually a problem
    if (diagnostic.code !== 2307) {
      printDiagnostic({cwd, logger, diagnostic})
    }
  }

  if (emitResult.emitSkipped) {
    const errors = allDiagnostics.filter((diag) => diag.category === ts.DiagnosticCategory.Error)

    if (errors.length) {
      throw new Error('failed to compile TypeScript definitions')
    }
  }
}
