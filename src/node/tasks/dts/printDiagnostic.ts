import path from 'node:path'

import chalk from 'chalk'
import ts from 'typescript'

import type {Logger} from '../../logger'

export function printDiagnostic(options: {
  cwd: string
  logger: Logger
  diagnostic: ts.Diagnostic
}): void {
  const {cwd, logger, diagnostic} = options

  if (diagnostic.file && diagnostic.start) {
    const {line, character} = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start)
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

    const file = path.relative(cwd, diagnostic.file.fileName)

    const output = [
      `${chalk.yellow(file)}:${chalk.blue(line + 1)}:${chalk.blue(character + 1)} - `,
      `${chalk.gray(`TS${diagnostic.code}:`)} ${message}`,
    ].join('')

    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      logger.error(output)
    }

    if (diagnostic.category === ts.DiagnosticCategory.Warning) {
      logger.warn(output)
    }

    if (diagnostic.category === ts.DiagnosticCategory.Message) {
      logger.log(output)
    }

    if (diagnostic.category === ts.DiagnosticCategory.Suggestion) {
      logger.log(output)
    }
  } else {
    logger.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
  }
}
