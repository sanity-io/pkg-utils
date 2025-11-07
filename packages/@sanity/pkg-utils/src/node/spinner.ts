// oxlint-disable no-console
import chalk from 'chalk'

export function createSpinner(
  msg: string,
  quiet = false,
): {complete: () => void; error: () => void} {
  const startTime = Date.now()

  if (!quiet) console.log(msg)

  return {
    complete: () => {
      if (!quiet)
        console.log(`${chalk.green('[success]')} ${chalk.gray(`${Date.now() - startTime}ms`)}`)
    },
    error: () => {
      console.log(`${chalk.red('[error]')} ${chalk.gray(`${Date.now() - startTime}ms`)}`)
    },
  }
}
