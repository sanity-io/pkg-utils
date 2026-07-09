import path from 'node:path'
import type ts from '@typescript/typescript6'
import chalk from 'chalk'
import type {TSCompilerApi} from '../../core/ts/compilerApi.ts'
import type {Logger} from '../../logger.ts'

export function printDiagnostic(options: {
  cwd: string
  logger: Logger
  diagnostic: ts.Diagnostic
  tsApi: TSCompilerApi
}): void {
  const {cwd, logger, diagnostic, tsApi} = options

  if (diagnostic.file && diagnostic.start !== undefined) {
    const {line, character} = tsApi.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start)
    const message = tsApi.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

    const file = path.relative(cwd, diagnostic.file.fileName)

    const output = [
      `${chalk.yellow(file)}:${chalk.blue(line + 1)}:${chalk.blue(character + 1)} - `,
      `${chalk.gray(`TS${diagnostic.code}:`)} ${message}`,
    ].join('')

    if (diagnostic.category === tsApi.DiagnosticCategory.Error) {
      logger.error(output)
    }

    if (diagnostic.category === tsApi.DiagnosticCategory.Warning) {
      logger.warn(output)
    }

    if (diagnostic.category === tsApi.DiagnosticCategory.Message) {
      logger.log(output)
    }

    if (diagnostic.category === tsApi.DiagnosticCategory.Suggestion) {
      logger.log(output)
    }
  } else {
    logger.log(tsApi.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
  }
}
