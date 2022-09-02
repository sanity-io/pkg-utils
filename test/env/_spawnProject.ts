/* eslint-disable no-console */

import fs from 'fs/promises'
import path from 'path'
import cpx from 'cpx'
import tmp from 'tmp'
import {_exec} from './_exec'
import {_ExecError} from './_ExecError'

export function _spawnProject(name: string): Promise<{
  cwd: string
  add: (pkg: string) => Promise<{stdout: string; stderr: string}>
  install: () => Promise<{stdout: string; stderr: string}>
  pack: () => Promise<{path: string}>
  readFile: (filePath: string) => Promise<string>
  remove: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  require: (id: string) => any
  run: (cmd: string) => Promise<{stdout: string; stderr: string}>
}> {
  return new Promise((resolve, reject) => {
    tmp.dir((err, tmpPath, tmpRemove) => {
      if (err) {
        reject(err)

        return
      }

      const packagePath = path.resolve(__dirname, '../__fixtures__', name)

      cpx.copy(path.resolve(packagePath, '**/*'), tmpPath, (cpxErr) => {
        if (cpxErr) {
          reject(cpxErr)

          return
        }

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require(path.resolve(tmpPath, 'package.json'))

        async function runExec(cmd: string) {
          try {
            const env = {
              ...process.env,
              PATH: `${process.env.PATH}:${path.resolve(__dirname, '../../bin')}`,
            }

            return _exec(cmd, {cwd: tmpPath, env})
          } catch (execErr) {
            if (execErr instanceof _ExecError) {
              console.log(execErr.stdout)
              console.error(execErr.stderr)

              return {stdout: execErr.stdout, stderr: execErr.stderr}
            }

            throw execErr
          }
        }

        resolve({
          cwd: tmpPath,
          add: (id: string) => runExec(`pnpm add ${id}`),
          install: () => runExec('pnpm install'),
          pack: async () => {
            await runExec('pnpm pack')

            return {path: path.resolve(tmpPath, `${pkg.name}-${pkg.version}.tgz`)}
          },
          readFile: (filePath: string) =>
            fs.readFile(path.resolve(tmpPath, filePath)).then((r) => r.toString()),
          remove: () => setTimeout(() => tmpRemove(), 0),
          require: (id) => require(path.resolve(tmpPath, id)),
          run: (cmd: string) => runExec(`pnpm run ${cmd}`),
        })
      })
    })
  })
}
