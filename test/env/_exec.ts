import child_process from 'child_process'
import {_ExecError} from './_ExecError'

export function _exec(
  command: string,
  options: child_process.ExecOptions = {}
): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    child_process.exec(command, options, (err, stdout, stderr) => {
      if (err) {
        const execErr = new _ExecError(err.message, stdout, stderr)

        execErr.stack = err.stack
        reject(execErr)

        return
      }

      resolve({stdout, stderr})
    })
  })
}
