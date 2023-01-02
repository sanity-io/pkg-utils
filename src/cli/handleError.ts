/* eslint-disable no-console */

import chalk from 'chalk'

export function handleError(err: unknown): void {
  if (err instanceof Error) {
    console.error(chalk.red('error'), err.message)
  } else {
    console.error(err)
  }

  process.exit(1)
}
