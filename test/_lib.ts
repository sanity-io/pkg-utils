import child_process from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import cpx from 'cpx'
import tmp from 'tmp'

export class ExecError extends Error {
  stdout: string
  stderr: string

  constructor(message: string, stdout: string, stderr: string) {
    super(message)
    this.stdout = stdout
    this.stderr = stderr
  }
}

function _exec(
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

export function _spawnProject(name: string): Promise<{
  cwd: string
  add: (pkg: string) => Promise<{stderr: string; stdout: string}>
  install: () => Promise<{stderr: string; stdout: string}>
  readFile: (filePath: string) => Promise<string>
  remove: () => void
  run: (cmd: string) => Promise<{stderr: string; stdout: string}>
}> {
  return new Promise((resolve, reject) => {
    tmp.dir((err, tmpPath, tmpRemove) => {
      if (err) {
        reject(err)

        return
      }

      cpx.copy(path.resolve(__dirname, '__fixtures__', name, '**/*'), tmpPath, (cpxErr) => {
        if (cpxErr) {
          reject(cpxErr)

          return
        }

        resolve({
          cwd: tmpPath,
          add: (pkg: string) => _exec(`pnpm add ${pkg}`, {cwd: tmpPath}),
          install: () => _exec('pnpm install', {cwd: tmpPath}),
          readFile: (filePath: string) =>
            fs.readFile(path.resolve(tmpPath, filePath)).then((r) => r.toString()),
          remove: tmpRemove,
          run: (cmd: string) => _exec(`pnpm run ${cmd}`, {cwd: tmpPath}),
        })
      })
    })
  })
}
