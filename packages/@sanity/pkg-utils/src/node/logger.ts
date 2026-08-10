// oxlint-disable no-console
import {styleText} from 'node:util'

/** @alpha */
export interface Logger {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  success: (...args: unknown[]) => void
}

/** @alpha */
export function createLogger(quiet = false): Logger {
  return {
    log: (...args) => {
      if (!quiet) console.log(...args)
    },
    info: (...args) => {
      if (!quiet) console.log(styleText('blue', '[info]'), ...args)
    },
    warn: (...args) => {
      console.log(styleText('yellow', '[warning]'), ...args)
    },
    error: (...args) => {
      console.log(styleText('red', '[error]'), ...args)
    },
    success: (...args) => {
      if (!quiet) console.log(styleText('green', '[success]'), ...args)
    },
  }
}
