/* eslint-disable no-console */

import chalk from 'chalk'

export function createSpinner(msg: string): {complete: () => void; error: () => void} {
  const startTime = Date.now()

  console.log(msg)

  return {
    complete: () => {
      console.log(`${chalk.green('[success]')} ${chalk.gray(`${Date.now() - startTime}ms`)}`)
    },
    error: () => {
      console.log(`${chalk.red('[error]')} ${chalk.gray(`${Date.now() - startTime}ms`)}`)
    },
  }
}
