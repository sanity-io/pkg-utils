/* eslint-disable no-console */

import chalk from 'chalk'

export function _handleError(err: unknown): void {
  if (err instanceof Error) {
    console.error(chalk.red('error'), err.message)
  }

  process.exit(1)
}
