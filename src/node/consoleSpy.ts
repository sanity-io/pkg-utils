/* eslint-disable no-console */

export interface ConsoleSpyMsg {
  type: 'log' | 'warn' | 'error'
  code?: string
  args: unknown[]
}

export interface ConsoleSpy {
  messages: ConsoleSpyMsg[]
  restore: () => void
}

export function createConsoleSpy(options?: {
  onRestored?: (messages: ConsoleSpyMsg[]) => void
}): ConsoleSpy {
  const {onRestored} = options || {}

  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  }

  const messages: ConsoleSpyMsg[] = []

  console.log = (...args: unknown[]) => messages.push({type: 'log', args})
  console.warn = (...args: unknown[]) => messages.push({type: 'warn', args})
  console.error = (...args: unknown[]) => messages.push({type: 'error', args})

  return {
    messages,
    restore: () => {
      console.log = original.log
      console.warn = original.warn
      console.error = original.error

      onRestored?.(messages)
    },
  }
}
