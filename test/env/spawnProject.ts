import fs from 'node:fs/promises'
import path from 'node:path'
import {copy} from 'fs-extra'
import globby from 'globby'
import {mkdirp} from 'mkdirp'
import {rimraf} from 'rimraf'
import {v4 as uuid} from 'uuid'
import {exec} from './exec'
import {ExecError} from './ExecError'
import {stripColor} from './stripColor'

async function tmpWorkspace() {
  const key = uuid()
  const workspacePath = path.resolve(__dirname, `__tmp__/${key}`)

  await mkdirp(workspacePath)

  return {
    path: workspacePath,
    remove: () => rimraf(workspacePath),
  }
}

export async function spawnProject(name: string): Promise<{
  cwd: string
  add: (pkg: string) => Promise<{stdout: string; stderr: string}>
  install: () => Promise<{stdout: string; stderr: string}>
  pack: () => Promise<{path: string}>
  readFile: (filePath: string) => Promise<string>
  remove: () => Promise<boolean>
  require: (id: string) => any
  run: (cmd: string) => Promise<{stdout: string; stderr: string}>
}> {
  const {path: tmpPath, remove: tmpRemove} = await tmpWorkspace()

  {
    const packagePath = path.resolve(__dirname, '../../playground', name)
    const files = await globby('**/*', {
      cwd: packagePath,
    })
    await Promise.all(
      files.map((file) => copy(path.join(packagePath, file), path.join(tmpPath, file))),
    )

    const pkg = require(path.resolve(tmpPath, 'package.json'))

    async function runExec(cmd: string) {
      try {
        const env = {
          ...process.env,
          PATH: `${process.env['PATH']}:${path.resolve(__dirname, '../../bin')}`,
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

    return {
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
    }
  }
}
