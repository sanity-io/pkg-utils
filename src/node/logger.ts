// oxlint-disable no-console
import chalk from 'chalk'

/** @alpha */
export interface Logger {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  success: (...args: unknown[]) => void
}

/** @alpha */
export function createLogger(): Logger {
  return {
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
  }
}
