import path from 'node:path'

import type {ExtractorMessage} from '@microsoft/api-extractor'
import chalk from 'chalk'

import type {BuildContext} from './core'

export function printExtractMessages(ctx: BuildContext, messages: ExtractorMessage[]): void {
  const {cwd, logger} = ctx

  const warnings = messages.filter((msg) => msg.logLevel === 'warning')

  if (warnings.length) {
    logger.log()
  }

  for (const msg of warnings) {
    const sourceFilePath = msg.sourceFilePath && path.relative(cwd, msg.sourceFilePath)

    if (msg.messageId === 'TS6307') {
      // Ignore this warning:
      // > TS6307: <filename> is not in project file list.
      // > Projects must list all files or use an 'include' pattern.
      continue
    }

    logger.log(
      [
        `${chalk.cyan(sourceFilePath || '?')}`,
        `:${chalk.yellow(msg.sourceFileLine)}:${chalk.yellow(msg.sourceFileColumn)}`,
        ` - ${chalk.yellow('warning')} ${chalk.gray(msg.messageId)}\n`,
        msg.text,
        '\n',
      ].join(''),
    )
  }

  const errors: ExtractorMessage[] = messages.filter((msg) => msg.logLevel === 'error')

  if (!warnings.length && errors.length) {
    logger.log('')
  }

  for (const msg of errors) {
    const sourceFilePath = msg.sourceFilePath && path.relative(cwd, msg.sourceFilePath)

    logger.log(
      [
        `${chalk.cyan(sourceFilePath || '?')}`,
        `:${chalk.yellow(msg.sourceFileLine)}:${chalk.yellow(msg.sourceFileColumn)}`,
        ` - ${chalk.red('error')} ${chalk.gray(msg.messageId)}\n`,
        msg.text,
        '\n',
      ].join(''),
    )
  }

  if (errors.length) {
    process.exit(1)
  }
}
