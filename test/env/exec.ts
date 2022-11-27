import child_process from 'child_process'
import {ExecError} from './ExecError'

export function exec(
  command: string,
  options: child_process.ExecOptions = {}
): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    child_process.exec(command, options, (err, stdout, stderr) => {
      if (err) {
        const execErr = new ExecError(err.message, stdout, stderr)

        execErr.stack = err.stack
        reject(execErr)

        return
      }

      resolve({stdout, stderr})
    })
  })
}
