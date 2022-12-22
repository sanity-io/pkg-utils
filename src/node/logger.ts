import chalk from 'chalk'

/** @internal */
export interface Logger {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  success: (...args: unknown[]) => void
}

/** @internal */
export function createLogger(): Logger {
  return {
    /* eslint-disable no-console */
    log: (...args) => {
      console.log(...args)
    },
    info: (...args) => {
      console.log(chalk.blue('[info]'), ...args)
    },
    warn: (...args) => {
      console.log(chalk.yellow('[warning]'), ...args)
    },
    error: (...args) => {
      console.log(chalk.red('[error]'), ...args)
    },
    success: (...args) => {
      console.log(chalk.green('[success]'), ...args)
    },
    /* eslint-enable no-console */
  }
}
