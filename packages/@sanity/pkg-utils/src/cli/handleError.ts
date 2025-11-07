import chalk from 'chalk'

export function handleError(err: unknown): void {
  if (err instanceof Error) {
    console.error(chalk.red('error'), err.stack)
  } else {
    console.error(err)
  }

  process.exit(1)
}
