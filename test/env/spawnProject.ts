/* eslint-disable no-console */

import fs from 'fs/promises'
import path from 'path'
import {promisify} from 'util'
import cpx from 'cpx'
import mkdirp from 'mkdirp'
import _rimraf from 'rimraf'
import {v4 as uuid} from 'uuid'
import {exec} from './exec'
import {ExecError} from './ExecError'
import {stripColor} from './stripColor'

const rimraf = promisify(_rimraf)

async function tmpWorkspace() {
  const key = uuid()
  const workspacePath = path.resolve(__dirname, `__tmp__/${key}`)

  await mkdirp(workspacePath)

  return {
    path: workspacePath,
    remove: () => rimraf(workspacePath),
  }
}

export function spawnProject(name: string): Promise<{
  cwd: string
  add: (pkg: string) => Promise<{stdout: string; stderr: string}>
  install: () => Promise<{stdout: string; stderr: string}>
  pack: () => Promise<{path: string}>
  readFile: (filePath: string) => Promise<string>
  remove: () => Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  require: (id: string) => any
  run: (cmd: string) => Promise<{stdout: string; stderr: string}>
}> {
  return new Promise((resolve, reject) => {
    tmpWorkspace()
      .then(({path: tmpPath, remove: tmpRemove}) => {
        const packagePath = path.resolve(__dirname, '../../playground', name)

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

              return exec(cmd, {cwd: tmpPath, env})
            } catch (execErr) {
              if (execErr instanceof ExecError) {
                console.log(execErr.stdout)
                console.error(execErr.stderr)

                return {
                  stdout: stripColor(execErr.stdout),
                  stderr: stripColor(execErr.stderr),
                }
              }

              throw execErr
            }
          }

          resolve({
            cwd: tmpPath,
            add: (id: string) => runExec(`pnpm add ${id}`),
            install: () => runExec('pnpm install --no-frozen-lockfile'),
            pack: async () => {
              await runExec('pnpm pack')

              return {path: path.resolve(tmpPath, `${pkg.name}-${pkg.version}.tgz`)}
            },
            readFile: (filePath: string) =>
              fs.readFile(path.resolve(tmpPath, filePath)).then((r) => r.toString()),
            remove: tmpRemove,
            require: (id) => require(path.resolve(tmpPath, id)),
            run: (cmd: string) => runExec(`pnpm run ${cmd}`),
          })
        })
      })
      .catch(reject)
  })
}
