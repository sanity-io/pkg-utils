import child_process from 'node:child_process'
import {ExecError} from './ExecError'

export function exec(
  command: string,
  options: child_process.ExecOptions = {},
): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    child_process.exec(command, options, (err, stdout, stderr) => {
      const stdoutStr = stdout.toString()
      const stderrStr = stderr.toString()

      if (err) {
        const execErr = new ExecError(err.message, stdoutStr, stderrStr)

        execErr.stack = err.stack!
        reject(execErr)

        return
      }

      resolve({stdout: stdoutStr, stderr: stderrStr})
    })
  })
}
