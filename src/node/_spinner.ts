import chalk from 'chalk'
import ora from 'ora'

export function _spinner(msg: string): {complete: () => void; error: () => void} {
  const startTime = Date.now()

  const spinner = ora({
    spinner: 'dots',
    text: `${chalk.yellow('run ')} ${msg}`,
  })

  spinner.color = 'yellow'

  spinner.start()

  return {
    complete: () => {
      spinner.color = 'green'
      spinner.succeed(`${chalk.green('ok  ')} ${msg} ${chalk.gray(`${Date.now() - startTime}ms`)}`)
    },
    error: () => {
      spinner.color = 'red'
      spinner.fail(chalk.red(`${msg} failed ${chalk.gray(`${Date.now() - startTime}ms`)}`))
    },
  }
}
