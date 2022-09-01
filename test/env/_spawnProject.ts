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
            return _exec(cmd, {cwd: tmpPath})
          } catch (err) {
            if (err instanceof _ExecError) {
              console.log(err.stdout)
              console.error(err.stderr)

              return {stdout: err.stdout, stderr: err.stderr}
            }

            throw err
          }
        }

        resolve({
          cwd: tmpPath,
          add: (pkg: string) => runExec(`pnpm add ${pkg}`),
          install: () => runExec('pnpm install'),
          pack: async () => {
            const log = await runExec('pnpm pack')

            console.log('log', log)

            return {path: path.resolve(tmpPath, `${pkg.name}-${pkg.version}.tgz`)}
          },
          readFile: (filePath: string) =>
            fs.readFile(path.resolve(tmpPath, filePath)).then((r) => r.toString()),
          remove: () => setTimeout(() => tmpRemove(), 0),
          run: (cmd: string) => runExec(`pnpm run ${cmd}`),
        })
      })
    })
  })
}
